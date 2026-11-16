#!/usr/bin/env python3
"""
Inference WebUI for the APTOS-2019 diabetic-retinopathy YOLO26 classifier.

Browse a gallery of dataset images, click one, and see the model's prediction
(top-5 with confidences) next to the known ground-truth grade.

    python webui.py                       # http://127.0.0.1:7860
    python webui.py --port 8000
    python webui.py --model runs/classify/yolo26n-cls-aptos/weights/best.pt
    python webui.py --host 0.0.0.0 --port 7860     # expose on a pod

Dependencies: Pillow + Ultralytics (Ultralytics pulls torch). Everything else is
Python standard library, so there is no web framework to install.
"""

from __future__ import annotations

import argparse
import io
import json
import random
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from PIL import Image

HERE = Path(__file__).resolve().parent
SPLITS = ("train", "val", "test")
IMG_EXT = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"}
SAFE_NAME = re.compile(r"^[A-Za-z0-9_.\-]+$")

# Clinical DR grade for each folder name (Ultralytics indices are alphabetical!)
GRADE = {"No_DR": 0, "Mild": 1, "Moderate": 2, "Severe": 3, "Proliferate_DR": 4}
SEVERITY_ORDER = ["No_DR", "Mild", "Moderate", "Severe", "Proliferate_DR"]


# --------------------------------------------------------------------------
# state
# --------------------------------------------------------------------------
class State:
    def __init__(self, dataset: Path, model_path: str, imgsz: int):
        self.dataset = dataset
        self.imgsz = imgsz
        self.lock = threading.Lock()
        self.thumb_cache: dict[tuple, bytes] = {}
        self.model = None
        self.model_error: str | None = None
        self.warning: str | None = None
        self.model_names: list[str] = []

        self.index: dict[str, dict[str, list[str]]] = {}
        for split in SPLITS:
            d = dataset / split
            if not d.is_dir():
                continue
            for cls_dir in sorted(p for p in d.iterdir() if p.is_dir()):
                ids = sorted(
                    f.name for f in cls_dir.iterdir() if f.suffix.lower() in IMG_EXT
                )
                if ids:
                    self.index.setdefault(split, {})[cls_dir.name] = ids

        self.classes = sorted({c for s in self.index.values() for c in s})
        self.total = sum(len(v) for s in self.index.values() for v in s.values())
        self._load_model(model_path)

    def _load_model(self, model_path: str) -> None:
        try:
            from ultralytics import YOLO

            self.model = YOLO(model_path)
            names = getattr(self.model, "names", {}) or {}
            self.model_names = list(names.values()) if isinstance(names, dict) else list(names)
            if set(self.model_names) != set(self.classes):
                self.warning = (
                    f"The loaded model predicts {len(self.model_names)} classes "
                    f"({', '.join(self.model_names[:5])}"
                    f"{'...' if len(self.model_names) > 5 else ''}) but the dataset has "
                    f"{len(self.classes)} ({', '.join(self.classes)}). Predictions will not "
                    f"match the ground-truth labels - point --model at a checkpoint trained "
                    f"on this dataset."
                )
        except Exception as exc:  # noqa: BLE001
            self.model_error = f"{type(exc).__name__}: {exc}"

    # ---- safe lookups (only exact filenames already indexed can be served) ----
    def image_path(self, split: str, cls: str, name: str) -> Path:
        if split not in self.index or cls not in self.index[split]:
            raise KeyError("unknown split/class")
        if not SAFE_NAME.match(name) or name not in set(self.index[split][cls]):
            raise KeyError("unknown image")
        path = (self.dataset / split / cls / name).resolve()
        if self.dataset not in path.parents:
            raise KeyError("path escapes dataset")
        return path

    def thumbnail(self, split: str, cls: str, name: str, size: int = 170) -> bytes:
        key = (split, cls, name, size)
        hit = self.thumb_cache.get(key)
        if hit is not None:
            return hit
        path = self.image_path(split, cls, name)
        with Image.open(path) as im:
            im = im.convert("RGB")
            im.thumbnail((size, size), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=82)
        data = buf.getvalue()
        if len(self.thumb_cache) > 6000:
            self.thumb_cache.clear()
        self.thumb_cache[key] = data
        return data

    def sample(self, split: str, cls: str, n: int, seed: int) -> list[dict]:
        pool: list[tuple[str, str, str]] = []
        splits = SPLITS if split == "all" else (split,)
        for s in splits:
            if s not in self.index:
                continue
            classes = self.classes if cls == "all" else [cls]
            for c in classes:
                for name in self.index[s].get(c, []):
                    pool.append((s, c, name))
        pool.sort()
        rng = random.Random(seed)
        if n < len(pool):
            pool = rng.sample(pool, n)
        out = []
        for s, c, name in pool:
            out.append({
                "id": name,
                "split": s,
                "cls": c,
                "grade": GRADE.get(c),
                "url": f"/thumb?split={s}&cls={c}&id={name}",
            })
        out.sort(key=lambda r: (SEVERITY_ORDER.index(r["cls"]), r["split"], r["id"]))
        return out

    def available(self, split: str, cls: str) -> int:
        splits = SPLITS if split == "all" else (split,)
        classes = self.classes if cls == "all" else [cls]
        return sum(
            len(self.index.get(s, {}).get(c, [])) for s in splits for c in classes
        )

    def predict(self, path: Path) -> tuple[list[dict], float]:
        if self.model is None:
            raise RuntimeError(self.model_error or "model not loaded")
        with self.lock:
            t0 = time.perf_counter()
            res = self.model.predict(source=str(path), imgsz=self.imgsz, verbose=False)[0]
            elapsed = (time.perf_counter() - t0) * 1000.0
        probs = res.probs
        names = res.names
        top5 = list(probs.top5)
        confs = [float(c) for c in probs.top5conf]
        preds = [
            {"cls": names[i] if not isinstance(names, dict) else names[i], "conf": c}
            for i, c in zip(top5, confs)
        ]
        return preds, elapsed


# --------------------------------------------------------------------------
# HTTP handler
# --------------------------------------------------------------------------
def make_handler(state: State):
    class Handler(BaseHTTPRequestHandler):
        server_version = "AngelWebUI/1.0"

        def log_message(self, fmt, *args):  # keep the console quiet-ish
            if "/thumb" not in (self.path or ""):
                print(f"  {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}")

        # ---- helpers ----
        def _json(self, obj, code=200):
            body = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _bytes(self, data: bytes, ctype: str, code=200):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "public, max-age=3600")
            self.end_headers()
            self.wfile.write(data)

        def _body(self) -> dict:
            n = int(self.headers.get("Content-Length") or 0)
            if not n:
                return {}
            try:
                return json.loads(self.rfile.read(n) or b"{}")
            except json.JSONDecodeError:
                return {}

        # ---- routes ----
        def do_GET(self):  # noqa: N802
            u = urlparse(self.path)
            q = parse_qs(u.query)
            try:
                if u.path in ("/", "/index.html"):
                    return self._bytes(INDEX_HTML.encode(), "text/html; charset=utf-8")

                if u.path == "/api/info":
                    return self._json({
                        "dataset": str(state.dataset),
                        "dataset_total": state.total,
                        "classes": state.classes,
                        "split_counts": {
                            s: {c: len(v) for c, v in sorted(d.items())}
                            for s, d in sorted(state.index.items())
                        },
                        "model_names": state.model_names,
                        "model_error": state.model_error,
                        "warning": state.warning,
                        "imgsz": state.imgsz,
                    })

                if u.path == "/api/images":
                    split = (q.get("split") or ["all"])[0]
                    cls = (q.get("cls") or ["all"])[0]
                    n = max(1, min(400, int((q.get("n") or ["48"])[0])))
                    seed = int((q.get("seed") or ["1"])[0])
                    if split not in (*SPLITS, "all") or cls not in (*state.classes, "all"):
                        return self._json({"error": "bad filter"}, 400)
                    return self._json({
                        "items": state.sample(split, cls, n, seed),
                        "available": state.available(split, cls),
                    })

                if u.path == "/thumb":
                    split = (q.get("split") or [""])[0]
                    cls = (q.get("cls") or [""])[0]
                    name = (q.get("id") or [""])[0]
                    try:
                        data = state.thumbnail(split, cls, name)
                    except KeyError:
                        return self._json({"error": "not found"}, 404)
                    return self._bytes(data, "image/jpeg")

                return self._json({"error": "not found"}, 404)
            except Exception as exc:  # noqa: BLE001
                return self._json({"error": f"{type(exc).__name__}: {exc}"}, 500)

        def do_POST(self):  # noqa: N802
            u = urlparse(self.path)
            body = self._body()
            try:
                if u.path == "/api/predict":
                    split, cls, name = body.get("split"), body.get("cls"), body.get("id")
                    path = state.image_path(split, cls, name)
                    preds, ms = state.predict(path)
                    top1 = preds[0] if preds else {"cls": None, "conf": 0.0}
                    return self._json({
                        "id": name, "split": split, "truth": cls,
                        "truth_grade": GRADE.get(cls),
                        "pred": top1["cls"], "conf": top1["conf"],
                        "correct": top1["cls"] == cls,
                        "top5": preds,
                        "ms": round(ms, 1),
                    })

                if u.path == "/api/evaluate":
                    items = body.get("items") or []
                    if not items:
                        return self._json({"error": "no items"}, 400)
                    items = items[:400]
                    per_class: dict[str, dict[str, int]] = {}
                    wrong = []
                    t0 = time.perf_counter()
                    for it in items:
                        split, cls, name = it.get("split"), it.get("cls"), it.get("id")
                        try:
                            path = state.image_path(split, cls, name)
                            preds, _ = state.predict(path)
                        except Exception:  # noqa: BLE001
                            continue
                        pred = preds[0]["cls"] if preds else None
                        st = per_class.setdefault(cls, {"n": 0, "correct": 0})
                        st["n"] += 1
                        if pred == cls:
                            st["correct"] += 1
                        else:
                            wrong.append({"id": name, "split": split, "truth": cls,
                                          "pred": pred,
                                          "conf": preds[0]["conf"] if preds else 0.0})
                    total = sum(v["n"] for v in per_class.values())
                    correct = sum(v["correct"] for v in per_class.values())
                    recalls = [v["correct"] / v["n"] for v in per_class.values() if v["n"]]
                    return self._json({
                        "n": total,
                        "correct": correct,
                        "accuracy": (correct / total) if total else None,
                        "balanced_accuracy": (sum(recalls) / len(recalls)) if recalls else None,
                        "per_class": {
                            c: {**v, "recall": v["correct"] / v["n"] if v["n"] else None}
                            for c, v in sorted(
                                per_class.items(), key=lambda kv: SEVERITY_ORDER.index(kv[0])
                            )
                        },
                        "wrong": wrong[:60],
                        "seconds": round(time.perf_counter() - t0, 2),
                    })

                return self._json({"error": "not found"}, 404)
            except KeyError:
                return self._json({"error": "unknown image"}, 404)
            except Exception as exc:  # noqa: BLE001
                return self._json({"error": f"{type(exc).__name__}: {exc}"}, 500)

    return Handler


# --------------------------------------------------------------------------
# frontend
# --------------------------------------------------------------------------
INDEX_HTML = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DR Inference - YOLO26 classifier</title>
<style>
  :root{
    --bg:#0e1117; --panel:#161b22; --panel2:#1c2230; --line:#2a3240;
    --fg:#e6edf3; --dim:#8b949e; --accent:#4c8dff; --ok:#3fb950; --bad:#f85149;
    --warn:#d29922;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);
    font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  header{padding:14px 20px;border-bottom:1px solid var(--line);background:var(--panel);
    position:sticky;top:0;z-index:10}
  h1{margin:0;font-size:16px;font-weight:650;letter-spacing:.2px}
  .sub{color:var(--dim);font-size:12px;margin-top:3px}
  .banner{margin:10px 20px 0;padding:10px 12px;border-radius:8px;font-size:13px}
  .banner.warn{background:rgba(210,153,34,.12);border:1px solid var(--warn);color:#f0d48a}
  .banner.err{background:rgba(248,81,73,.12);border:1px solid var(--bad);color:#ffb4b0}
  .bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px 20px}
  label{color:var(--dim);font-size:12px;text-transform:uppercase;letter-spacing:.4px}
  select,input,button{background:var(--panel2);color:var(--fg);border:1px solid var(--line);
    border-radius:7px;padding:7px 10px;font-size:13px;font-family:inherit}
  button{cursor:pointer}
  button:hover{border-color:var(--accent)}
  button.primary{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
  button.primary:hover{filter:brightness(1.1)}
  button:disabled{opacity:.5;cursor:not-allowed}
  main{display:grid;grid-template-columns:1fr 400px;gap:16px;padding:0 20px 28px;align-items:start}
  @media(max-width:1050px){main{grid-template-columns:1fr}}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(122px,1fr));gap:9px}
  .card{background:var(--panel);border:2px solid var(--line);border-radius:9px;overflow:hidden;
    cursor:pointer;transition:border-color .12s,transform .12s;position:relative}
  .card:hover{border-color:var(--accent);transform:translateY(-2px)}
  .card.sel{border-color:var(--accent);box-shadow:0 0 0 2px rgba(76,141,255,.3)}
  .card img{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#000}
  .card .cap{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(transparent,#000c);
    padding:12px 6px 4px;font-size:10.5px;display:flex;justify-content:space-between;gap:4px}
  .card .cap .g{color:var(--dim)}
  .panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:15px}
  .panel h2{margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.6px;color:var(--dim)}
  .big{width:100%;border-radius:9px;background:#000;display:block}
  .kv{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line);
    font-size:13px}
  .kv:last-child{border-bottom:0}
  .kv span:first-child{color:var(--dim)}
  .verdict{margin:12px 0;padding:11px;border-radius:8px;text-align:center;font-weight:650}
  .verdict.ok{background:rgba(63,185,80,.14);border:1px solid var(--ok);color:#7ee787}
  .verdict.bad{background:rgba(248,81,73,.13);border:1px solid var(--bad);color:#ffa198}
  .pred{margin:8px 0}
  .pred .top{display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px}
  .pred .top b{font-weight:600}
  .track{height:8px;background:var(--panel2);border-radius:5px;overflow:hidden}
  .fill{height:100%;background:var(--accent);border-radius:5px}
  .pred.first .fill{background:var(--ok)}
  .pred.truth .top b::after{content:" (ground truth)";color:var(--dim);font-weight:400;font-size:11px}
  .muted{color:var(--dim);font-size:12px}
  .err{color:var(--bad)}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  th,td{text-align:left;padding:5px 6px;border-bottom:1px solid var(--line)}
  th{color:var(--dim);font-weight:500}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  .row{display:flex;gap:8px}
  .row>*{flex:1}
  .spin{display:inline-block;width:13px;height:13px;border:2px solid var(--line);
    border-top-color:var(--accent);border-radius:50%;animation:s .7s linear infinite;vertical-align:-2px}
  @keyframes s{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<header>
  <h1>Diabetic Retinopathy &mdash; inference</h1>
  <div class="sub" id="sub">loading&hellip;</div>
</header>
<div id="banners"></div>

<div class="bar">
  <label for="split">Split</label>
  <select id="split">
    <option value="all">all</option><option>train</option><option>val</option><option>test</option>
  </select>
  <label for="cls">Class</label>
  <select id="cls"><option value="all">all</option></select>
  <label for="n">Show</label>
  <select id="n">
    <option>24</option><option selected>48</option><option>96</option><option>192</option>
  </select>
  <button id="shuffle">&#x21bb; Reshuffle</button>
  <button id="evaluate" class="primary">Evaluate visible</button>
  <span id="status" class="muted"></span>
</div>

<main>
  <div>
    <div class="grid" id="grid"></div>
    <div id="evalbox" style="margin-top:18px"></div>
  </div>

  <div class="panel" id="detail">
    <h2>Prediction</h2>
    <div class="muted">Click any image to run inference on it.</div>
  </div>
</main>

<script>
const $ = s => document.querySelector(s);
let items = [], sel = -1, info = null;

function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function severityRank(c){ return ["No_DR","Mild","Moderate","Severe","Proliferate_DR"].indexOf(c); }

async function boot(){
  info = await (await fetch('/api/info')).json();
  const cls = $('#cls');
  info.classes.forEach(c => { const o = document.createElement('option'); o.textContent = c; cls.appendChild(o); });

  const cc = info.split_counts, tot = {};
  Object.values(cc).forEach(d => Object.entries(d).forEach(([k,v]) => tot[k] = (tot[k]||0)+v));
  $('#sub').innerHTML = esc(info.dataset) + " &middot; " + info.dataset_total + " images &middot; "
    + Object.entries(tot).sort((a,b)=>severityRank(a[0])-severityRank(b[0]))
        .map(([k,v])=> esc(k)+" "+v).join(" &middot; ")
    + " &middot; imgsz " + info.imgsz;

  const b = $('#banners');
  if (info.model_error) b.innerHTML += '<div class="banner err"><b>Model failed to load.</b> ' + esc(info.model_error) + '</div>';
  if (info.warning)     b.innerHTML += '<div class="banner warn">' + esc(info.warning) + '</div>';

  await load();
}

async function load(){
  $('#status').innerHTML = '<span class="spin"></span>';
  const seed = Math.floor(Math.random()*1e9);
  const u = `/api/images?split=${$('#split').value}&cls=${$('#cls').value}&n=${$('#n').value}&seed=${seed}`;
  const r = await (await fetch(u)).json();
  items = r.items; sel = -1;
  $('#status').textContent = `showing ${items.length} of ${r.available}`;
  $('#evalbox').innerHTML = '';
  renderGrid();
  $('#detail').innerHTML = '<h2>Prediction</h2><div class="muted">Click any image to run inference on it.</div>';
}

function renderGrid(){
  const g = $('#grid');
  g.innerHTML = items.map((it,i) => `
    <div class="card${i===sel?' sel':''}" data-i="${i}">
      <img loading="lazy" src="${it.url}" alt="">
      <div class="cap"><span>${esc(it.cls)}</span><span class="g">${it.split}</span></div>
    </div>`).join('');
  g.querySelectorAll('.card').forEach(el =>
    el.addEventListener('click', () => pick(+el.dataset.i)));
}

async function pick(i){
  sel = i;
  renderGrid();
  const it = items[i];
  $('#detail').innerHTML = `<h2>Prediction</h2>
    <img class="big" src="${it.url}" alt="">
    <div style="margin-top:10px"><span class="spin"></span> running inference&hellip;</div>`;

  let r;
  try {
    r = await (await fetch('/api/predict', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({split:it.split, cls:it.cls, id:it.id})})).json();
  } catch(e){ r = {error:String(e)}; }
  if (r.error){ $('#detail').innerHTML += `<div class="err">${esc(r.error)}</div>`; return; }
  showResult(it, r);
}

function showResult(it, r){
  const bars = r.top5.map((p,ix) => `
    <div class="pred ${ix===0?'first':''} ${p.cls===r.truth?'truth':''}">
      <div class="top"><b>${esc(p.cls)}</b><span>${(p.conf*100).toFixed(2)}%</span></div>
      <div class="track"><div class="fill" style="width:${(p.conf*100).toFixed(2)}%"></div></div>
    </div>`).join('');

  $('#detail').innerHTML = `
    <h2>Prediction</h2>
    <img class="big" src="${it.url}" alt="">
    <div class="verdict ${r.correct?'ok':'bad'}">
      ${r.correct ? 'CORRECT' : 'WRONG'} &nbsp;&middot;&nbsp; predicted <b>${esc(r.pred)}</b>
      &nbsp;&middot;&nbsp; truth <b>${esc(r.truth)}</b>
    </div>
    <div class="kv"><span>file</span><span>${esc(r.id)}</span></div>
    <div class="kv"><span>split</span><span>${esc(r.split)}</span></div>
    <div class="kv"><span>ground truth</span><span>${esc(r.truth)} &nbsp;<span class="muted">grade ${r.truth_grade}</span></span></div>
    <div class="kv"><span>confidence</span><span>${(r.conf*100).toFixed(2)}%</span></div>
    <div class="kv"><span>inference</span><span>${r.ms} ms</span></div>
    <h2 style="margin-top:16px">Top-5</h2>
    ${bars}
    <div class="row" style="margin-top:14px">
      <button id="prev" ${sel<=0?'disabled':''}>&larr; Prev</button>
      <button id="next" ${sel>=items.length-1?'disabled':''}>Next &rarr;</button>
    </div>`;
  $('#prev')?.addEventListener('click', () => pick(sel-1));
  $('#next')?.addEventListener('click', () => pick(sel+1));
}

async function evaluate(){
  if (!items.length) return;
  const btn = $('#evaluate');
  btn.disabled = true;
  $('#evalbox').innerHTML = `<div class="panel"><span class="spin"></span> evaluating ${items.length} images on CPU&hellip;</div>`;
  let r;
  try {
    r = await (await fetch('/api/evaluate', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({items})})).json();
  } catch(e){ r = {error:String(e)}; }
  btn.disabled = false;
  if (r.error){ $('#evalbox').innerHTML = `<div class="panel err">${esc(r.error)}</div>`; return; }

  const rows = Object.entries(r.per_class).map(([c,v]) => `
    <tr><td>${esc(c)}</td><td class="num">${v.n}</td><td class="num">${v.correct}</td>
    <td class="num">${v.recall===null?'-':(v.recall*100).toFixed(1)+'%'}</td></tr>`).join('');
  const wrong = r.wrong.length ? `
    <h2 style="margin-top:16px">Misclassified (${r.wrong.length})</h2>
    <table><tr><th>file</th><th>truth</th><th>predicted</th><th>conf</th></tr>
    ${r.wrong.slice(0,25).map(w=>`<tr><td class="muted">${esc(w.id)}</td><td>${esc(w.truth)}</td>
      <td>${esc(w.pred)}</td><td class="num">${(w.conf*100).toFixed(1)}%</td></tr>`).join('')}
    </table>` : '';

  $('#evalbox').innerHTML = `
    <div class="panel">
      <h2>Evaluation &mdash; ${r.n} images in ${r.seconds}s</h2>
      <div class="kv"><span>accuracy</span><span>${(r.accuracy*100).toFixed(2)}%</span></div>
      <div class="kv"><span>balanced accuracy (macro recall)</span><span>${(r.balanced_accuracy*100).toFixed(2)}%</span></div>
      <table style="margin-top:12px"><tr><th>class</th><th>n</th><th>correct</th><th>recall</th></tr>${rows}</table>
      <div class="muted" style="margin-top:10px">This is a small random sample, not the full test split - treat it as an illustration, not a benchmark.</div>
      ${wrong}
    </div>`;
}

$('#shuffle').addEventListener('click', load);
$('#split').addEventListener('change', load);
$('#cls').addEventListener('change', load);
$('#n').addEventListener('change', load);
$('#evaluate').addEventListener('click', evaluate);
document.addEventListener('keydown', e => {
  if (sel < 0) return;
  if (e.key === 'ArrowLeft' && sel > 0) pick(sel-1);
  if (e.key === 'ArrowRight' && sel < items.length-1) pick(sel+1);
});
boot();
</script>
</body>
</html>
"""


# --------------------------------------------------------------------------
def discover_dataset(value: str) -> Path | None:
    p = Path(value).expanduser()
    for cand in (p, HERE / p):
        if cand.is_dir() and any((cand / s).is_dir() for s in ("train", "val", "test")):
            return cand.resolve()
    return None


def discover_model(explicit: str | None) -> str:
    """Prefer an explicit path, else the newest best.pt under runs/classify."""
    if explicit:
        return explicit
    candidates = sorted(
        HERE.glob("runs/classify/*/weights/best.pt"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if candidates:
        return str(candidates[0])
    return "yolo26n-cls.pt"


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--dataset", default="dataset", help="Dataset root (default: %(default)s)")
    ap.add_argument("--model", default=None,
                    help="Checkpoint .pt or model name. Default: newest "
                         "runs/classify/*/weights/best.pt, else yolo26n-cls.pt")
    ap.add_argument("--imgsz", type=int, default=224)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=7860)
    args = ap.parse_args()

    dataset = discover_dataset(args.dataset)
    if dataset is None:
        print(f"Could not find a dataset directory at '{args.dataset}'.", flush=True)
        return 2
    model_path = discover_model(args.model)

    print(f"Dataset : {dataset}", flush=True)
    print(f"Model   : {model_path}", flush=True)
    print("Loading model (first run may download weights)...", flush=True)
    state = State(dataset, model_path, args.imgsz)
    if state.model_error:
        print(f"! model error: {state.model_error}", flush=True)
    else:
        print(f"Classes : {', '.join(state.model_names) or '(unknown)'}", flush=True)
    if state.warning:
        print(f"! {state.warning}", flush=True)

    httpd = ThreadingHTTPServer((args.host, args.port), make_handler(state))
    url = f"http://{args.host}:{args.port}"
    print(f"\n  WebUI ready at {url}\n", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

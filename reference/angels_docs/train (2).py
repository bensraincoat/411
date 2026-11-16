#!/usr/bin/env python3
"""
Train a YOLO26 classification model (yolo26n-cls) on the APTOS-2019 DR dataset.

This script is designed to sit NEXT TO the dataset folder:

    <anywhere>/
    ├── train.py          <- this file
    ├── dataset/          <- unzip dataset_yolo26n_cls.zip here
    │   ├── train/
    │   ├── val/
    │   └── test/
    └── README.md

`--data` is resolved against the current directory first and then against this
script's own directory, so all of these work:

    python train.py                              # run from the folder with dataset/
    python /workspace/train.py                   # run from anywhere
    python train.py --data /workspace/dataset    # explicit path

Docs: https://docs.ultralytics.com/tasks/classify/
      https://docs.ultralytics.com/models/yolo26/

Examples
--------
    # full run on a GPU pod
    python train.py --epochs 100 --imgsz 224 --batch 64 --device 0 --report-balanced

    # CPU-friendly
    python train.py --epochs 30 --imgsz 224 --batch 32 --device cpu

    # quick smoke test (~1 min)
    python train.py --epochs 1 --imgsz 64 --batch 32 --name smoke

Notes
-----
* `data` points at the dataset DIRECTORY (not a .yaml) - that is the Ultralytics
  classification convention.
* Images are natively 224x224, so imgsz=224 avoids upscaling artefacts.
* This dataset is imbalanced (~10.9x between No_DR and Severe). Ultralytics
  classification has no class-weight argument, so `--report-balanced` prints
  per-class recall and balanced accuracy, which is the honest metric here.
* Class indices are ALPHABETICAL, not clinical grade:
      Mild=0, Moderate=1, No_DR=2, Proliferate_DR=3, Severe=4
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
IMG_EXT = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"}


def resolve_dataset(value: str) -> Path | None:
    """Find the dataset directory: current dir first, then this script's dir."""
    p = Path(value).expanduser()
    for candidate in (p, HERE / p):
        if candidate.is_dir() and any(
            (candidate / s).is_dir() for s in ("train", "val", "valid", "test")
        ):
            return candidate.resolve()
    return None


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--data", default="dataset",
                   help="Dataset root directory (default: %(default)s).")
    p.add_argument("--model", default="yolo26n-cls.pt",
                   help="Pretrained checkpoint or YAML (default: %(default)s).")
    p.add_argument("--epochs", type=int, default=100)
    p.add_argument("--imgsz", type=int, default=224)
    p.add_argument("--batch", type=int, default=32, help="Use -1 for auto batch.")
    p.add_argument("--device", default=None,
                   help="'cpu', '0', '0,1', or omit for auto-detect.")
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--patience", type=int, default=20, help="Early-stopping patience.")
    p.add_argument("--seed", type=int, default=42, help="Reproducibility seed.")
    p.add_argument("--lr0", type=float, default=None, help="Initial LR (default: auto).")
    p.add_argument("--dropout", type=float, default=None, help="Classifier dropout.")
    p.add_argument("--project", default=None,
                   help="Output dir (default: runs/classify next to this script).")
    p.add_argument("--name", default="yolo26n-cls-aptos", help="Run name.")
    p.add_argument("--resume", action="store_true")
    p.add_argument("--report-balanced", action="store_true",
                   help="Evaluate on the test split and print per-class recall "
                        "and balanced accuracy.")
    return p.parse_args()


def main() -> int:
    args = parse_args()

    try:
        from ultralytics import YOLO
    except ImportError:
        print("ultralytics is not installed.\n"
              "  python -m pip install ultralytics", file=sys.stderr)
        return 2

    data_dir = resolve_dataset(args.data)
    if data_dir is None:
        print(f"Could not find a dataset directory at '{args.data}'.\n"
              f"Looked in:\n"
              f"  {Path(args.data).resolve()}\n"
              f"  {(HERE / args.data).resolve()}\n"
              f"Unzip the dataset next to this script:\n"
              f"  unzip dataset_yolo26n_cls.zip\n"
              f"or pass an explicit path with --data /path/to/dataset",
              file=sys.stderr)
        return 2
    print(f"Dataset: {data_dir}")

    project = Path(args.project) if args.project else HERE / "runs" / "classify"

    model = YOLO(args.model)

    train_kwargs = dict(
        data=str(data_dir),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        workers=args.workers,
        patience=args.patience,
        seed=args.seed,
        deterministic=True,
        project=str(project),
        name=args.name,
        exist_ok=True,
        resume=args.resume,
        plots=True,
    )
    if args.device:
        train_kwargs["device"] = args.device
    if args.lr0 is not None:
        train_kwargs["lr0"] = args.lr0
    if args.dropout is not None:
        train_kwargs["dropout"] = args.dropout

    print("Training with:", train_kwargs)
    results = model.train(**train_kwargs)
    save_dir = getattr(results, "save_dir", None)
    print(f"\nArtifacts: {save_dir}")

    # ---- evaluate on the held-out test split ----------------------------
    best = Path(save_dir) / "weights" / "best.pt" if save_dir else None
    eval_model = YOLO(str(best)) if best and best.exists() else model
    metrics = eval_model.val(data=str(data_dir), split="test", imgsz=args.imgsz,
                             batch=args.batch, workers=args.workers,
                             project=str(project), name=f"{args.name}-test")

    top1 = getattr(metrics, "top1", None)
    top5 = getattr(metrics, "top5", None)
    print("\n=== Test-split metrics ===")
    if top1 is not None:
        print(f"top-1 accuracy: {float(top1) * 100:.2f}%")
    if top5 is not None:
        print(f"top-5 accuracy: {float(top5) * 100:.2f}%")

    if args.report_balanced:
        try:
            import numpy as np
            cm = metrics.confusion_matrix
            matrix = np.asarray(cm.matrix, dtype=float)
            names = list(getattr(cm, "names", {}).values())
            k = min(len(names), matrix.shape[0], matrix.shape[1])
            diag = np.diag(matrix)[:k]

            # Ground-truth counts are read from disk, not from the confusion
            # matrix, so this stays correct regardless of whether the installed
            # Ultralytics version stores matrix[pred, true] or [true, pred].
            split_dir = data_dir / "test"
            support = np.zeros(k, dtype=float)
            for i, n in enumerate(names[:k]):
                d = split_dir / str(n)
                if d.is_dir():
                    support[i] = sum(1 for f in d.iterdir()
                                     if f.suffix.lower() in IMG_EXT)
            recall = np.divide(diag, support, out=np.full(k, np.nan, dtype=float),
                               where=support > 0)

            print("\nPer-class recall on the test split:")
            for i, n in enumerate(names[:k]):
                print(f"  {n:<18} recall={recall[i]:.3f}  "
                      f"correct={int(diag[i])}/{int(support[i])}")
            print(f"\nbalanced accuracy (macro recall) : {np.nanmean(recall):.3f}")
            if top1 is not None:
                print(f"top-1 accuracy                   : {float(top1):.3f}")
            print("\nCompare runs on balanced accuracy, not top-1: with a ~10.9x "
                  "class imbalance, top-1 is dominated by No_DR. After very short "
                  "training the model may never predict Severe, so its recall can "
                  "legitimately be 0.000.")
        except Exception as exc:  # noqa: BLE001
            print(f"(could not compute balanced accuracy: {exc!r})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

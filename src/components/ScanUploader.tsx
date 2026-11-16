import { useEffect, useRef, useState } from "react";
import { Check, Info, Loader2, ScanLine, ScanEye, UploadCloud, X } from "lucide-react";
import { errorMessage, predictRetinalImage, type Prediction } from "../api";
import { Button } from "./ui";
import { Link } from "../router";
import { ResearchScanExplanation } from "./ResearchScanExplanation";

type Preview = { file: File; url: string };
const MAX_FILES = 6;
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const VALID_TYPES = ["image/png", "image/jpeg"];
const GRADES = ["No DR", "Mild NPDR", "Moderate NPDR", "Severe NPDR", "Proliferative DR"];

/** Experimental predictions saved only to authenticated research-test history. */
export function ScanUploader() {
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [results, setResults] = useState<Record<string, Prediction>>({});
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [confirmedTestData, setConfirmedTestData] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<Preview[]>([]);

  useEffect(() => { previewsRef.current = previews; }, [previews]);
  useEffect(() => {
    return () => previewsRef.current.forEach((p) => URL.revokeObjectURL(p.url));
  }, []);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0 || running) return;
    const candidates = Array.from(list);
    const valid = candidates.filter((file) =>
      VALID_TYPES.includes(file.type) && file.size <= MAX_SIZE_BYTES
    );
    setError(valid.length === candidates.length ? "" : "Only JPG/PNG images of 10 MB or less are supported.");
    const available = Math.max(0, MAX_FILES - previews.length);
    const selected = valid.slice(0, available);
    if (valid.length > available) setError(`You can select up to ${MAX_FILES} images at once.`);
    const added = selected.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviews((current) => [...current, ...added]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(url: string) {
    URL.revokeObjectURL(url);
    setPreviews((current) => current.filter((p) => p.url !== url));
    setResults((current) => {
      const next = { ...current };
      delete next[url];
      return next;
    });
  }

  function clearFiles() {
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    setPreviews([]);
    setResults({});
    setError("");
    setConfirmedTestData(false);
    setCompleted(0);
  }

  async function runScreening() {
    if (running || previews.length === 0 || !confirmedTestData) return;
    setError("");
    setResults({});
    setRunning(true);
    setCompleted(0);
    try {
      // Sequential CPU inference avoids running multiple models simultaneously.
      for (const [index, item] of previews.entries()) {
        const prediction = await predictRetinalImage(item.file, "", "YOLO26 Nano");
        setResults((current) => ({ ...current, [item.url]: prediction }));
        setCompleted(index + 1);
      }
    } catch (err) {
      setError(`${errorMessage(err)} Results already completed remain visible.`);
    } finally {
      setRunning(false);
    }
  }

  const analyzing = running ? previews[completed] : undefined;
  const finished = previews.filter((item) => results[item.url]);
  const canRun = !running && previews.length > 0 && confirmedTestData;

  return (
    <div className="scan-layout">

      {/* ---------- LEFT: add photographs and run ---------- */}
      <section className="panel scan-panel" aria-label="Add photographs">
        <h2 className="card-title">Photographs</h2>

        <button
          type="button"
          className={`drop-zone${dragging ? " is-dragging" : ""}`}
          disabled={running}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          <span className="upload-orbit"><UploadCloud /></span>
          <strong>Add retinal photographs</strong>
          <small>Click or drag · JPG/PNG · up to {MAX_FILES} files · 10 MB each</small>
        </button>
        <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg"
          multiple disabled={running} onChange={(event) => addFiles(event.target.files)} />

        {previews.length > 0 && (
          <ul className="upload-list">
            {previews.map(({ file, url }) => (
              <li key={url}>
                <img src={url} alt="" />
                <span title={file.name}>{file.name}</span>
                {results[url] && <Check className="upload-done" aria-label="Analyzed" />}
                <button type="button" aria-label={`Remove ${file.name}`}
                  disabled={running} onClick={() => removeFile(url)}><X /></button>
              </li>
            ))}
          </ul>
        )}

        {previews.length > 0 && (
          <label className="confirm-check">
            <input type="checkbox" checked={confirmedTestData} disabled={running}
              onChange={(e) => setConfirmedTestData(e.target.checked)} />
            <span>I confirm these are non-identifiable retinal fundus test images.</span>
          </label>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        <Button type="button" size="lg" className="w-full" disabled={!canRun} onClick={runScreening}>
          <ScanLine /> {running ? `Analyzing ${completed + 1} of ${previews.length}…` : "Begin openI scan"}
        </Button>

        {running && (
          <span className="bar-track" role="progressbar" aria-label="Analysis progress"
            aria-valuemin={0} aria-valuemax={previews.length} aria-valuenow={completed}>
            <span className="bar-fill is-progress" style={{ width: `${(completed / previews.length) * 100}%` }} />
          </span>
        )}

        {previews.length > 0 && !running && (
          <Button variant="ghost" type="button" size="sm" className="clear-link" onClick={clearFiles}>
            Clear all
          </Button>
        )}

        <div className="research-note">
          <p>
            <Info aria-hidden="true" />
            Research use only. Use non-identifiable fundus photographs. Results are not a diagnosis.
          </p>
          <details>
            <summary>About this test</summary>
            <p>
              This experimental classifier (YOLO26 Nano) is not clinically validated. Never rely on its
              grade for diagnosis or treatment, and do not upload identifiable patient records.
              Experimental Grad-CAM explanations are available on saved test results. Images are
              processed locally by Flask, and test predictions and images are stored in your private
              research history. Only authorized clinicians can access them.
            </p>
          </details>
        </div>
      </section>


      {/* ---------- RIGHT: results ---------- */}
      <section className="scan-results" aria-label="Retinal research predictions" aria-live="polite">
        {finished.length === 0 && !analyzing && (
          <div className="panel results-empty">
            <div className="mini-retina"><ScanEye /></div>
            <h2>{previews.length === 0 ? "Results will appear here" : "Ready to scan"}</h2>
            <p>
              {previews.length === 0
                ? "Add one or more retinal photographs to get started."
                : "Confirm the images are test photographs, then begin the scan."}
            </p>
          </div>
        )}

        {finished.map(({ file, url }) => {
          const prediction = results[url];
          return (
            <article className="panel result-row" key={url}>
              <img className="result-thumb" src={url} alt={`Retinal test photograph ${file.name}`} />

              <div className="result-body">
                <div className="result-heading">
                  <span className={`grade grade-${prediction.grade}`}>Level {prediction.grade}</span>
                  <h2>{prediction.label}</h2>
                </div>

                <p className="result-meta">
                  <span title="A model score, not a clinical probability">
                    {(prediction.confidence * 100).toFixed(1)}% model score
                  </span>
                  <span className="result-file" title={file.name}>{file.name}</span>
                </p>

                {prediction.scan_id && (
                  <p className="result-saved">
                    <Check aria-hidden="true" /> Saved to research history ·{" "}
                    <Link to="/dashboard">View in portal</Link>
                  </p>
                )}

                {prediction.scan_id && (
                  <ResearchScanExplanation scanId={prediction.scan_id} grade={prediction.grade} label={prediction.label} />
                )}

                {prediction.probabilities && (
                  <details className="score-details">
                    <summary>All five model scores</summary>
                    <ul className="bars">
                      {GRADES.map((name) => {
                        const value = prediction.probabilities?.[name] ?? 0;
                        return (
                          <li key={name} className={`bar-row${name === prediction.label ? " is-top" : ""}`}>
                            <span className="bar-name">{name}</span>
                            <span className="bar-track" aria-hidden="true">
                              <span className="bar-fill" style={{ width: `${value * 100}%` }} />
                            </span>
                            <span className="bar-value">{(value * 100).toFixed(1)}%</span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}

                <p className="feature-disclaimer">Experimental research result. Not a diagnosis.</p>
              </div>
            </article>
          );
        })}

        {analyzing && (
          <article className="panel result-row is-pending" aria-busy="true">
            <img className="result-thumb" src={analyzing.url} alt="" />
            <div className="result-body">
              <p className="result-working"><Loader2 className="animate-spin" /> Analyzing {analyzing.file.name}…</p>
            </div>
          </article>
        )}
      </section>
    </div>
  );
}

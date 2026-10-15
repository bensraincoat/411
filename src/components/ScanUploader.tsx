import { useEffect, useRef, useState } from "react";
import { FileImage, ScanLine, Trash2, UploadCloud } from "lucide-react";
import { errorMessage, predictRetinalImage, type Prediction } from "../api";
import { Button } from "./ui";
import { Link } from "../router";
import { ResearchScanExplanation } from "./ResearchScanExplanation";
import "./RetinaExplanationCompact.css";

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

  return (
    <div className="scan-workspace">
      <div className="clinical-note" role="status">
        <strong>YOLO26 Nano — research testing</strong>
        <p>
          This experimental classifier is not clinically validated. Use test fundus
          photographs only, never rely on its grade for diagnosis or treatment,
          and do not upload identifiable patient records. Experimental Grad-CAM explanations
          are available on saved test results. Images are processed locally by Flask and
          test predictions and images are stored in your private research history. Only authorized clinicians can access them.
        </p>
      </div>

      <button type="button" className="drop-zone" disabled={running}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}>
        <span className="upload-orbit"><UploadCloud /></span>
        <strong>Select retinal test photographs</strong>
        <small>Click to browse or drag files here · JPG/PNG · 6 files max · 10 MB each</small>
      </button>
      <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg"
        multiple disabled={running} onChange={(event) => addFiles(event.target.files)} />

      {previews.length > 0 && (
        <>
          <div className="file-strip">
            {previews.map((item) => (
              <div key={item.url}>
                <FileImage />
                <span title={item.file.name}>{item.file.name}</span>
                <button type="button" aria-label={`Remove ${item.file.name}`}
                  disabled={running} onClick={() => removeFile(item.url)}><Trash2 /></button>
              </div>
            ))}
          </div>
          <section className="results-section retina26-results-section" aria-label="Retinal research predictions">
            <div className="section-heading">
              <span>Research screening</span><h2>Selected photographs</h2>
              <p>These results are experimental model outputs, not clinical findings.</p>
            </div>
            <div className="retina26-results-list">
              {previews.map(({ file, url }) => {
                const prediction = results[url];
                return (
                  <article className="retina26-result" key={url}>
                    <img className="retina26-result-thumb" src={url} alt={`Retinal test photograph ${file.name}`} />
                    <div className="retina26-result-body">
                      <div className="retina26-result-top">
                        <h3>{prediction ? `${prediction.label} — Grade ${prediction.grade}` : "Awaiting model test"}</h3>
                        {prediction && <span className="retina26-result-confidence">Model score: {(prediction.confidence * 100).toFixed(1)}%</span>}
                      </div>
                      <p className="retina26-result-file">{file.name}</p>
                      {prediction ? (
                        <>
                          <p className="retina26-result-subline">Experimental classification, not a diagnosis. The score is not a clinical probability.</p>
                          {prediction.scan_id && (
                            <p className="retina26-result-saved"><strong>Saved to research history.</strong> <Link to="/dashboard">View patient portal</Link></p>
                          )}
                          {prediction.scan_id && (
                            <ResearchScanExplanation scanId={prediction.scan_id} grade={prediction.grade} label={prediction.label} />
                          )}
                          {prediction.probabilities && (
                            <details className="retina26-prob-details">
                              <summary>Show all five model scores</summary>
                              <div className="retina26-prob-grid">
                                {GRADES.map((name) => (
                                  <span key={name}>{name}: {((prediction.probabilities?.[name] ?? 0) * 100).toFixed(1)}%</span>
                                ))}
                              </div>
                            </details>
                          )}
                        </>
                      ) : <p className="retina26-result-subline">No result has been generated for this photograph yet.</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}

      {previews.length > 0 && (
        <label style={{ display: "block", marginTop: 16 }}>
          <input type="checkbox" checked={confirmedTestData} disabled={running}
            onChange={(e) => setConfirmedTestData(e.target.checked)} />{" "}
          I confirm these are non-identifiable retinal fundus test images.
        </label>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="process-row">
        <span>{previews.length} photograph{previews.length === 1 ? "" : "s"} selected{running ? ` · ${completed} of ${previews.length} analyzed` : ""}</span>
        <div>
          <Button variant="outline" type="button" disabled={running} onClick={clearFiles}>Clear</Button>
          <Button type="button" disabled={running || previews.length === 0 || !confirmedTestData}
            onClick={runScreening}>
            <ScanLine /> {running ? "Analyzing…" : "Begin openI scan"}
          </Button>
        </div>
      </div>
    </div>
  );
}

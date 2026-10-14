import { useRef, useState } from "react";
import { FileImage, LoaderCircle, ScanLine, Trash2, UploadCloud } from "lucide-react";

import { Button, Input } from "./ui";
import { confirmScanReview, errorMessage, predictRetinalImage, type Prediction } from "../api";

export const MODELS = ["YOLO"];

type ScanResult = {
  file: File;
  url: string;
  prediction?: Prediction;
  error?: string;
  confirmed?: boolean;
};

const pct = (value: number) => Math.round(value <= 1 ? value * 100 : value);

export function ScanUploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [patientId, setPatientId] = useState("P-10432");
  const model = "YOLO";
  const [results, setResults] = useState<ScanResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function accept(next: FileList | null) {
    if (!next) return;
    const valid = Array.from(next).filter((file) => ["image/png", "image/jpeg"].includes(file.type));
    if (valid.length !== next.length) setError("Only PNG and JPG retinal photographs can be analyzed.");
    else setError("");
    setFiles((current) => [...current, ...valid].slice(0, 6));
    setResults([]);
  }

  async function processFiles() {
    if (!files.length) return setError("Add at least one retinal photograph first.");
    if (!patientId.trim()) return setError("Enter a patient ID.");
    setError(""); setProcessing(true); setResults([]);

    const next = await Promise.all(files.map(async (file): Promise<ScanResult> => {
      const url = URL.createObjectURL(file);
      try {
        return { file, url, prediction: await predictRetinalImage(file, patientId.trim(), model) };
      } catch (err) {
        return { file, url, error: errorMessage(err) };
      }
    }));
    setResults(next);
    setProcessing(false);
  }

  async function confirm(index: number) {
    const scanId = results[index]?.prediction?.scan_id;
    try {
      if (scanId) await confirmScanReview(scanId);
      setResults((current) => current.map((r, i) => i === index ? { ...r, confirmed: true } : r));
    } catch (err) {
      setResults((current) => current.map((r, i) => i === index ? { ...r, error: errorMessage(err) } : r));
    }
  }

  return (
    <div className="scan-workspace">
      <div className="scan-controls">
        <div className="field-group"><label htmlFor="patient-id">Patient ID</label><Input id="patient-id" value={patientId} onChange={(e) => setPatientId(e.target.value)} /></div>
      </div>

      <button type="button" className="drop-zone" onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); accept(e.dataTransfer.files); }}>
        <span className="upload-orbit"><UploadCloud /></span><strong>Drop retinal photographs here</strong><small>or click to browse · PNG or JPG · up to 6 files</small>
      </button>
      <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg" multiple onChange={(e) => accept(e.target.files)} />

      {files.length > 0 && <div className="file-strip">{files.map((file, index) => <div key={`${file.name}-${index}`}><FileImage /><span>{file.name}</span><button aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}><Trash2 /></button></div>)}</div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="process-row"><span>{files.length} photograph{files.length === 1 ? "" : "s"} ready</span><div><Button variant="outline" onClick={() => { setFiles([]); setResults([]); }}>Clear</Button><Button onClick={processFiles} disabled={processing}>{processing ? <><LoaderCircle className="animate-spin" />Analyzing</> : <><ScanLine />Analyze photographs</>}</Button></div></div>

      {results.length > 0 && (
        <section className="results-section" aria-live="polite">
          <div className="section-heading"><span>Screening output</span><h2>Analysis results</h2></div>
          <div className="result-grid">
            {results.map((result, index) => {
              const p = result.prediction;
              const grade = p?.grade;
              const label = p?.label;
              const confidence = p?.confidence;
              return (
                <article className="result-card" key={result.url}>
                  <img src={result.url} alt={`Uploaded retinal photograph ${result.file.name}`} />
                  <div className="result-content">
                    {result.error ? (
                      <><h3>Analysis unavailable</h3><p className="form-error" role="alert">{result.error}</p></>
                    ) : (
                      <>
                        <div className="result-top"><span className={`grade grade-${grade ?? 0}`}>Level {grade ?? "–"}</span>{confidence !== undefined && <span>{pct(confidence)}% confidence</span>}</div>
                        <h3>{label}</h3>
                        
                        {p?.model && <p><b>Model:</b> {p.model}</p>}
                        <p>{p?.explanation}</p>
                      </>
                    )}
                    <div className="result-foot"><span>{result.file.name}</span>{!result.error && <Button variant="outline" size="sm" onClick={() => confirm(index)} disabled={result.confirmed}>{result.confirmed ? "Review confirmed" : "Confirm review"}</Button>}</div>
                  </div>
                </article>
              );
            })}
          </div>
          <aside className="clinical-note"><strong>Clinical review required</strong><p>These results are screening support only. They are not a diagnosis or treatment recommendation.</p></aside>
        </section>
      )}
    </div>
  );
}

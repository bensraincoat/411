import { useEffect, useState } from "react";
import { API_BASE_URL, tokenStore } from "../api/client";
import "./RetinaExplanationCompact.css";

type Explanation = {
  model_input: string;
  overlay: string;
  layer: string;
  method: string;
  notice: string;
  grade: number;
  label: string;
};

type GradeEducation = { title: string; overview: string; typicalFindings: string };

// These describe clinical categories in general, NOT findings detected in this image.
const categoryEducation: Record<number, GradeEducation> = {
  0: {
    title: "Understanding No DR (Grade 0)",
    overview: "The model grouped this photograph with examples labeled No DR. In an eye examination, No DR means no visible diabetic-retinopathy changes were found. This prediction alone cannot prove that an eye is healthy.",
    typicalFindings: "A clinician checks the retina — the light-sensitive layer at the back of the eye — for tiny red dots from bulging blood vessels (microaneurysms), little bleeding spots, yellow deposits from leaking vessels (hard exudates), and swelling. The No DR category is used when characteristic diabetic-retinopathy changes are not seen during a proper assessment.",
  },
  1: {
    title: "Understanding Mild DR (Grade 1)",
    overview: "Mild nonproliferative diabetic retinopathy is the earliest visible stage of diabetes-related damage to the retina's tiny blood vessels. Vision may still seem normal at this stage.",
    typicalFindings: "Eye specialists mainly look for microaneurysms: tiny, balloon-like bulges in the walls of very small retinal blood vessels. These can appear as pinpoint red dots in a retinal photograph. In the standard grading scale, Mild DR means these early bulges are present without the more extensive changes used to classify higher grades.",
  },
  2: {
    title: "Understanding Moderate DR (Grade 2)",
    overview: "Moderate nonproliferative diabetic retinopathy means more retinal blood vessels show damage than in Mild DR, but the findings do not yet meet the criteria for Severe DR.",
    typicalFindings: "When grading this stage, clinicians may see more microaneurysms and small bleeding spots inside the retina (retinal hemorrhages). Some eyes also show yellow deposits from leaking blood vessels (hard exudates), fluffy-looking pale spots linked to reduced blood supply (cotton-wool spots), or irregular-looking small vessels. Not every person has every sign.",
  },
  3: {
    title: "Understanding Severe DR (Grade 3)",
    overview: "Severe nonproliferative diabetic retinopathy is an advanced stage of damage to the existing retinal blood vessels. Parts of the retina may not be receiving enough blood and oxygen.",
    typicalFindings: "An eye specialist looks for widespread bleeding or many tiny bulging vessels, veins that appear unevenly swollen (venous beading), and unusual small blood-vessel channels within the retina (called IRMA). These are signs of significant circulation problems. In this stage, the abnormal new surface vessels that define Proliferative DR have not yet developed.",
  },
  4: {
    title: "Understanding Proliferative DR (Grade 4)",
    overview: "Proliferative diabetic retinopathy is the most advanced category in this grading system. Long-term damage can reduce blood and oxygen delivery to parts of the retina, leading the eye to grow new blood vessels where they should not normally grow.",
    typicalFindings: "Doctors identify this stage by looking for abnormal new blood vessels on the retina or near the optic nerve. These vessels are very fragile and can bleed into the jelly-like gel inside the eye, sometimes causing floaters or a sudden drop in vision. Scar tissue may also form and pull on the retina. The key clinical difference from Severe DR is this abnormal new blood-vessel growth, called neovascularization.",
  },
};

export function ResearchScanExplanation({ scanId, grade, label }: { scanId: string; grade: number; label: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Explanation>();
  const [error, setError] = useState("");

  useEffect(() => {
    setOpen(false);
    setLoading(false);
    setData(undefined);
    setError("");
  }, [scanId]);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setError("");
    if (data) return;
    setLoading(true);
    try {
      const token = tokenStore.get();
      if (!token) throw new Error("Sign in to view this research explanation.");
      const response = await fetch(`${API_BASE_URL}/api/research-scans/${encodeURIComponent(scanId)}/explanation`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to generate this explanation.");
      setData(payload as Explanation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The explanation could not be generated.");
    } finally {
      setLoading(false);
    }
  }

  const info = categoryEducation[grade];
  return (
    <div className="retina26-xai-wrap">
      <button type="button" className="retina26-xai-button" disabled={loading} onClick={toggle} aria-expanded={open}>
        {loading ? "Preparing explanation…" : open ? "Hide explanation" : "Why did the AI choose this?"}
      </button>
      {open && (
        <section aria-label="Experimental AI explanation" className="retina26-xai-panel">
          <div className="retina26-xai-title">
            <strong>{info?.title ?? "Why this result?"}</strong>
            <span>Research only</span>
          </div>
          <p className="retina26-xai-lead">{info?.overview ?? `The model predicted ${label} (Grade ${grade}), but it has not identified specific retinal findings.`}</p>
          <div className="retina26-xai-education">
            <strong>How do eye specialists usually recognize this grade?</strong>
            <p>{info?.typicalFindings ?? "A clinician must review the retinal photograph to identify particular abnormalities."}</p>
          </div>
          {loading && <p role="status" className="retina26-xai-status">Generating the model's influence map on your computer…</p>}
          {error && <p role="alert" className="retina26-xai-error">{error}</p>}
          {data && (
            <details className="retina26-heatmap-details">
              <summary>View Grad-CAM heatmap</summary>
              <div className="retina26-heatmap-layout">
                <figure>
                  <img src={data.overlay} alt="Research Grad-CAM overlay of the test retinal photograph" />
                  <figcaption>Orange and red indicate stronger positive influence on the selected model class.</figcaption>
                </figure>
                <div>
                  <strong>What do the colors mean?</strong>
                  <p>They show which image regions influenced this prediction. They do <strong>not</strong> prove that bleeding, blocked vessels, or other lesions are present.</p>
                  <details className="retina26-technical-details">
                    <summary>More about this explanation</summary>
                    <p>Method: {data.method}. Heatmaps can emphasize image borders, camera artifacts or unrelated patterns. Only an eye-care professional can interpret clinical findings.</p>
                  </details>
                </div>
              </div>
            </details>
          )}
          <p className="retina26-xai-disclaimer">These are general descriptions of a DR category, not findings confirmed in this photograph. This research-only model cannot diagnose lesions or guide treatment.</p>
        </section>
      )}
    </div>
  );
}

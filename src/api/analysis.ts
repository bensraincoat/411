import { apiRequest } from "./client";
import type { ModelComparison, Prediction } from "./types";

/**
 * POST /predict  (multipart/form-data)
 *   image: File, patient_id: string, model: string
 * → Prediction JSON
 */
export async function predictRetinalImage(
  image: File,
  patientId: string,
  model: string
): Promise<Prediction> {
  const form = new FormData();

  form.append("images", image);
  form.append("patient_id", patientId);
  form.append("model", model);

  const response = await apiRequest<{
    predictions: Array<{
      filename: string;
      grade: 0 | 1 | 2 | 3 | 4;
      label: string;
      confidence: number;
      message: string;
    }>;
  }>("/api/predict", {
    method: "POST",
    body: form,
  });

  const prediction = response.predictions[0];

  return {
    grade: prediction.grade,
    label: prediction.label,
    confidence: prediction.confidence,
    explanation: prediction.message,
    model: model,
  };
}

/**
 * POST /compare-models  (multipart/form-data)
 *   image: File, patient_id: string, models: comma-separated list (also sent as repeated "models[]")
 * → ModelComparison JSON
 */
export function compareModels(image: File, patientId: string, models: string[]) {
  const form = new FormData();
  form.append("image", image);
  form.append("patient_id", patientId);
  form.append("models", models.join(","));
  models.forEach((m) => form.append("models[]", m));
  return apiRequest<ModelComparison>("/compare-models", { method: "POST", body: form });
}

/** POST /scans/:id/confirm — marks an analysis as reviewed. */
export function confirmScanReview(scanId: string) {
  return apiRequest<{ ok: boolean }>(`/scans/${encodeURIComponent(scanId)}/confirm`, { method: "POST" });
}

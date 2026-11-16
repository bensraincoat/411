/**
 * Numbers behind the homepage "How the model compares" card.
 *
 * Everything is derived from raw inputs below so teammates can audit it:
 *  - openI model: confusion matrix from the test-split run of yolo26n-cls
 *    (reference/angels_docs/runs (2).tar -> yolo26n-cls-aptos-test/confusion_matrix.png).
 *  - Baselines: per-class recall, accuracy and Cohen's kappa copied from
 *    Table 2 of reference/pratishka-report.pdf ("Performance metrics results of
 *    the experiments of all models").
 *
 * Caveats shown to the reader on the page: both use APTOS-2019 but different
 * test splits (537 vs 366 images), so this is indicative, not a controlled benchmark.
 */

export type MetricKey = "accuracy" | "balanced" | "kappa";

// ---------- openI model (YOLO26n-cls) ----------

// Rows = predicted, columns = true. Order: Mild, Moderate, No DR, Proliferative, Severe.
const confusion = [
  [26, 15, 1, 0, 0],
  [16, 122, 1, 15, 17],
  [8, 2, 268, 0, 0],
  [3, 4, 0, 25, 1],
  [1, 3, 0, 1, 8],
];

function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

function confusionMetrics(matrix: number[][]) {
  const n = matrix.length;
  const total = sum(matrix.flat());
  const diagonal = matrix.map((row, i) => row[i]);
  const trueTotals = Array.from({ length: n }, (_, j) => sum(matrix.map((row) => row[j])));
  const predictedTotals = matrix.map((row) => sum(row));

  const observed = sum(diagonal) / total;
  const expected = sum(trueTotals.map((t, i) => t * predictedTotals[i])) / (total * total);

  return {
    accuracy: observed,
    balanced: sum(diagonal.map((d, i) => d / trueTotals[i])) / n,
    kappa: (observed - expected) / (1 - expected),
  };
}

const ours = confusionMetrics(confusion);

// ---------- Baselines (Pratishka report, Table 2) ----------

type Run = {
  accuracy: number;
  kappa?: number; // not reported for every run
  // Recall per class, order: No DR, Mild, Moderate, Severe, Proliferative.
  recall: [number, number, number, number, number];
};

const baselines: { name: string; runs: Run[] }[] = [
  {
    name: "DenseNet121",
    runs: [
      { accuracy: 0.809, kappa: 0.689, recall: [0.97, 0.47, 0.9, 0.24, 0.21] },
      { accuracy: 0.808, recall: [0.97, 0.53, 0.82, 0.06, 0.45] },
    ],
  },
  {
    name: "ResNet50",
    runs: [
      { accuracy: 0.7923, kappa: 0.659, recall: [0.97, 0.4, 0.87, 0.06, 0.21] },
      { accuracy: 0.7459, kappa: 0.609, recall: [0.94, 0.63, 0.52, 0.59, 0.33] },
    ],
  },
  {
    name: "Inception V3",
    runs: [
      { accuracy: 0.7288, kappa: 0.571, recall: [0.9, 0.5, 0.75, 0.18, 0.09] },
      { accuracy: 0.7513, kappa: 0.617, recall: [0.92, 0.77, 0.54, 0.41, 0.42] },
    ],
  },
  {
    name: "MobileNetV2",
    runs: [
      { accuracy: 0.808, kappa: 0.665, recall: [0.97, 0.53, 0.84, 0.24, 0.27] },
      { accuracy: 0.7568, recall: [0.93, 0.53, 0.65, 0.16, 0.42] },
    ],
  },
  {
    name: "Xception",
    runs: [
      { accuracy: 0.795, kappa: 0.689, recall: [0.97, 0.5, 0.85, 0.12, 0.21] },
      { accuracy: 0.7486, recall: [0.96, 0.67, 0.46, 0.53, 0.42] },
    ],
  },
];

function runValue(run: Run, metric: MetricKey): number | undefined {
  if (metric === "accuracy") return run.accuracy;
  if (metric === "kappa") return run.kappa;
  return sum(run.recall) / run.recall.length;
}

/** Each baseline is represented by its better run (with or without class weights). */
function bestRun(runs: Run[], metric: MetricKey) {
  const values = runs
    .map((run) => runValue(run, metric))
    .filter((value): value is number => value !== undefined);
  return Math.max(...values);
}

export type ComparisonRow = { name: string; value: number; ours?: boolean };

export function comparisonRows(metric: MetricKey): ComparisonRow[] {
  const rows: ComparisonRow[] = baselines.map((b) => ({
    name: b.name,
    value: bestRun(b.runs, metric),
  }));
  rows.sort((a, b) => b.value - a.value);
  return [{ name: "openI (YOLO26n)", value: ours[metric], ours: true }, ...rows];
}

export const metricLabels: Record<MetricKey, { tab: string; hint: string }> = {
  accuracy: { tab: "Accuracy", hint: "Share of test images graded correctly." },
  balanced: { tab: "Balanced", hint: "Average recall across all five levels." },
  kappa: { tab: "Kappa", hint: "Agreement beyond chance (1.0 is perfect)." },
};

export function formatMetric(metric: MetricKey, value: number) {
  return metric === "kappa" ? value.toFixed(3) : `${(value * 100).toFixed(1)}%`;
}

export function formatDelta(metric: MetricKey, delta: number) {
  const sign = delta >= 0 ? "+" : "−";
  const magnitude = Math.abs(delta);
  return metric === "kappa" ? `${sign}${magnitude.toFixed(3)}` : `${sign}${(magnitude * 100).toFixed(1)} pts`;
}

export const comparisonNote =
  "APTOS-2019 test images. Baselines are each model's better run from the 2025 Timalsina report. " +
  "Test splits differ (537 vs 366 images), so treat this as indicative.";

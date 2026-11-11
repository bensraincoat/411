import { useState } from "react";

import {
  comparisonNote,
  comparisonRows,
  formatDelta,
  formatMetric,
  metricLabels,
  type MetricKey,
} from "../data/modelComparison";

const metrics = Object.keys(metricLabels) as MetricKey[];

export function ModelComparison() {
  const [metric, setMetric] = useState<MetricKey>("accuracy");

  const rows = comparisonRows(metric);
  const ours = rows[0];
  const bestBaseline = rows[1];

  return (
    <section className="compare" aria-label="How the openI model compares with earlier models">
      <div className="compare-head">
        <h2>How our model compares</h2>

        <div className="seg" role="group" aria-label="Metric">
          {metrics.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={metric === key}
              onClick={() => setMetric(key)}
            >
              {metricLabels[key].tab}
            </button>
          ))}
        </div>
      </div>

      <div className="compare-stat">
        <strong>{formatMetric(metric, ours.value)}</strong>
        <span className="delta-pill">
          {formatDelta(metric, ours.value - bestBaseline.value)} vs {bestBaseline.name}
        </span>
      </div>
      <p className="compare-hint">{metricLabels[metric].hint}</p>

      <ul className="bars">
        {rows.map((row) => (
          <li key={row.name} className={`bar-row${row.ours ? " is-ours" : ""}`}>
            <span className="bar-name">{row.name}</span>
            <span className="bar-track" aria-hidden="true">
              <span className="bar-fill" style={{ width: `${row.value * 100}%` }} />
            </span>
            <span className="bar-value">{formatMetric(metric, row.value)}</span>
          </li>
        ))}
      </ul>

      <p className="compare-note">{comparisonNote}</p>
    </section>
  );
}

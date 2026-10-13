import {
  Activity,
  ArrowRight,
  Eye,
  ScanEye,
  ShieldCheck,
} from "lucide-react";

import { AppShell } from "../components/AppShell";
import { Link } from "../router";

const grades = [
  [
    "0",
    "No DR",
    "No visible abnormalities associated with diabetic retinopathy.",
  ],
  [
    "1",
    "Mild",
    "Small areas of vessel swelling known as microaneurysms.",
  ],
  [
    "2",
    "Moderate",
    "Vessels nourishing the retina may become blocked.",
  ],
  [
    "3",
    "Severe",
    "More vessels are blocked, reducing retinal blood supply.",
  ],
  [
    "4",
    "Proliferative",
    "New, fragile blood vessels may grow across the retina.",
  ],
];

export function Home() {
  return (
    <AppShell tone="vanilla">
      <main>
        <section className="hero-band">
          <div className="hero-inner">
            <div>
              <span className="eyebrow">
                <ScanEye />
                Eye health, made visible
              </span>

              <h1>
                See risk sooner.
                <br />
                <em>Protect sight longer.</em>
              </h1>

              <p>
                openI helps patients and clinicians turn retinal
                photographs into clear diabetic retinopathy screening
                support.
              </p>

              <div className="hero-actions">
                <Link className="btn btn-lg" to="/analyze">
                  Start an analysis
                  <ArrowRight />
                </Link>

                <Link
                  className="btn btn-outline btn-lg"
                  to="/auth"
                >
                  Create patient account
                </Link>
              </div>
            </div>

            <div
              className="eye-visual"
              aria-label="Abstract visualization of a retinal scan"
            >
              <span className="retina-ring ring-one" />
              <span className="retina-ring ring-two" />

              <span className="optic-disc">
                <Eye />
              </span>

              <span className="scan-line" />
            </div>
          </div>
        </section>

        <section className="content-band intro-grid">
          <div className="section-heading">
            <span>Understanding the condition</span>

            <h2>
              Diabetic retinopathy can progress quietly.
            </h2>
          </div>

          <div className="body-copy">
            <p>
              High blood sugar can damage the small blood vessels
              in the retina, which is the light sensitive tissue
              at the back of the eye. Early changes may happen
              before vision feels different.
            </p>

            <p>
              Regular screening can identify signs sooner,
              helping an ophthalmologist plan follow-up care
              before preventable vision loss occurs.
            </p>
          </div>
        </section>

        <section className="signal-band">
          <article>
            <Activity />
            <strong>9.6 million</strong>
            <span>
              people in the U.S. estimated to live with DR
            </span>
          </article>

          <article>
            <Eye />
            <strong>5 grades</strong>
            <span>
              from no visible DR to proliferative disease
            </span>
          </article>

          <article>
            <ShieldCheck />
            <strong>Early action</strong>
            <span>
              supports timely specialist review and care
            </span>
          </article>
        </section>

        <section className="content-band">
          <div className="section-heading">
            <span>Severity scale</span>

            <h2>
              Five grades. One clear pathway.
            </h2>

            <p>
              The documented classification system separates
              retinal findings into five levels.
            </p>
          </div>

          <div className="grade-list">
            {grades.map(([level, name, text]) => (
              <article key={level}>
                <span className={`grade grade-${level}`}>
                  Level {level}
                </span>

                <h3>{name}</h3>

                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cta-band">
          <div>
            <span>Ready when you are</span>

            <h2>
              Bring your retinal photographs into focus.
            </h2>
          </div>

          <Link className="btn btn-lg" to="/analyze">
            Analyze photographs
            <ArrowRight />
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
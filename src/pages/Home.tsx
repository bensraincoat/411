import {
  ArrowRight,
  ClipboardPlus,
  Eye,
  ScanEye,
  ScanSearch,
  Share2,
  Stethoscope,
  Upload,
  UserRound,
} from "lucide-react";

import { AppShell } from "../components/AppShell";
import { Link } from "../router";

const steps = [
  {
    icon: Upload,
    title: "Upload",
    text: "Add a retinal photograph taken during a clinic visit.",
  },
  {
    icon: ScanSearch,
    title: "Review",
    text: "The model grades it from level 0 to 4, and a heatmap shows what influenced the result.",
  },
  {
    icon: Share2,
    title: "Share",
    text: "Send results to an ophthalmologist for follow-up care.",
  },
];

const roles = [
  {
    icon: UserRound,
    title: "Patients",
    text: "Keep your screening history in one place and choose who can see it.",
    to: "/auth?role=patient",
    cta: "Patient portal",
  },
  {
    icon: ClipboardPlus,
    title: "Nurses",
    text: "Upload photographs during a visit and pass results to the care team.",
    soon: true,
  },
  {
    icon: Stethoscope,
    title: "Ophthalmologists",
    text: "Review shared results, run your own screenings, and leave guidance.",
    to: "/auth?role=doctor",
    cta: "Clinician workspace",
  },
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
                Open source · Diabetic retinopathy
              </span>

              <h1>
                An open-source platform for <em>diabetic retinopathy</em> screening.
              </h1>

              <p>
                From retinal photograph to explained result, for patients,
                nurses, and ophthalmologists.
              </p>

              <div className="hero-actions">
                <Link className="btn btn-lg" to="/analyze">
                  Start a screening
                  <ArrowRight />
                </Link>

                <Link className="text-link" to="/auth">
                  Sign in
                  <ArrowRight />
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

        <section className="content-band home-section">
          <h2 className="home-heading">How it works</h2>

          <div className="step-grid">
            {steps.map(({ icon: Icon, title, text }, index) => (
              <article key={title} className="step">
                <span className="step-number">{index + 1}</span>
                <Icon aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="content-band home-section home-section-last">
          <h2 className="home-heading">Built for the whole care team</h2>

          <div className="role-grid">
            {roles.map(({ icon: Icon, title, text, to, cta, soon }) => (
              <article key={title} className="role-card">
                <Icon aria-hidden="true" />
                <h3>
                  {title}
                  {soon && <span className="soon-tag">Coming soon</span>}
                </h3>
                <p>{text}</p>
                {to && (
                  <Link className="text-link" to={to}>
                    {cta}
                    <ArrowRight />
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}

import {
  ArrowRight,
  ClipboardPlus,
  ScanEye,
  ScanSearch,
  Share2,
  Stethoscope,
  Upload,
  UserRound,
} from "lucide-react";

import { AppShell } from "../components/AppShell";
import { ModelComparison } from "../components/ModelComparison";
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
      <main className="home-main">
        <section className="home-hero">
          <div>

            <h1>
              An open-source platform for <em>diabetic retinopathy</em> screening.
            </h1>

            <p className="lede">
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

          <ModelComparison />
        </section>

        <div className="home-bottom">
          <section aria-labelledby="how-heading">
            <h2 id="how-heading" className="home-heading">How it works</h2>

            <ol className="home-list">
              {steps.map(({ icon: Icon, title, text }, index) => (
                <li key={title}>
                  <Icon aria-hidden="true" />
                  <div>
                    <strong>{index + 1}. {title}</strong>
                    <span>{text}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="team-heading">
            <h2 id="team-heading" className="home-heading">Built for the whole care team</h2>

            <ul className="home-list">
              {roles.map(({ icon: Icon, title, text, to, cta, soon }) => (
                <li key={title}>
                  <Icon aria-hidden="true" />
                  <div>
                    <strong>
                      {title}
                      {soon && <span className="soon-tag">Coming soon</span>}
                      {to && (
                        <Link className="text-link" to={to}>
                          {cta}
                          <ArrowRight />
                        </Link>
                      )}
                    </strong>
                    <span>{text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </AppShell>
  );
}

import { useState } from "react";
import { CalendarCheck, Check, Clock3 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Button, Input } from "../components/ui";
import { Link } from "../router";
import { errorMessage, listDoctors, requestAppointment } from "../api";
import { useApi } from "../hooks/useApi";
import { PLACEHOLDER_DOCTORS } from "../data/placeholders";

const localDay = (date: Date) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");

const tips = [
  "Bring your most recent retinal photographs or screening ID so your clinician can compare results.",
  "Dilated examinations can blur near vision for a few hours, so arrange a ride if you can.",
  "Share your records only with the clinician you approve, and revoke access whenever you like.",
];

export function Book() {
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: doctors } = useApi(listDoctors, PLACEHOLDER_DOCTORS);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError("");
    try {
      await requestAppointment({ doctor_id: String(f.get("doctor")), date: String(f.get("date")), time: String(f.get("time")), reason: String(f.get("reason") ?? "") });
      setRequested(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main className="portal-shell dash">
        <header className="dash-head">
          <div>
            <span className="dash-role">Appointments</span>
            <h1>Book an appointment</h1>
          </div>
        </header>

        <div className="dash-grid">
          <section className="panel book-panel">
            <h2 className="card-title">When would you like to be seen?</h2>

            {requested ? (
              <div className="book-done" role="status">
                <span className="book-done-icon"><CalendarCheck /></span>
                <h3>Request sent</h3>
                <p>The clinic will confirm your appointment and let you know when your clinician accepts.</p>
                <div className="book-done-actions">
                  <Link className="btn" to="/dashboard">Go to my portal</Link>
                  <Button variant="ghost" onClick={() => setRequested(false)}>Request another</Button>
                </div>
              </div>
            ) : (
              <form className="booking-form" onSubmit={submit}>
                <div className="field-group"><label htmlFor="clinic">Ophthalmologist</label><select id="clinic" name="doctor">{doctors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.specialty}, {d.clinic}</option>)}</select></div>
                <div className="form-pair"><div className="field-group"><label htmlFor="date">Preferred date</label><Input id="date" name="date" type="date" required min={localDay(today)} defaultValue={localDay(tomorrow)} /></div><div className="field-group"><label htmlFor="time">Preferred time</label><Input id="time" name="time" type="time" required defaultValue="10:30" /></div></div>
                <div className="field-group"><label htmlFor="reason">What would you like to discuss?</label><textarea id="reason" name="reason" placeholder="Review my latest retinal screening, discuss next steps…" /></div>
                {error && <p className="form-error" role="alert">{error}</p>}
                <Button size="lg" type="submit" disabled={busy}><Clock3 />Request appointment</Button>
                <p className="form-hint">Requests are held until the clinic confirms your slot.</p>
              </form>
            )}
          </section>

          <aside className="panel">
            <h2 className="card-title">Before your visit</h2>
            <ul className="expect-list">
              {tips.map((tip) => (
                <li key={tip}><Check /><span>{tip}</span></li>
              ))}
            </ul>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

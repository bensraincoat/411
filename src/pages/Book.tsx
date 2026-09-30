import { useState } from "react";
import { CalendarCheck, Clock3, ShieldCheck, Stethoscope } from "lucide-react";
import { AppShell, PageIntro } from "../components/AppShell";
import { Button, Input } from "../components/ui";
import { errorMessage, listDoctors, requestAppointment } from "../api";
import { useApi } from "../hooks/useApi";
import { PLACEHOLDER_DOCTORS } from "../data/placeholders";

export function Book() {
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: doctors } = useApi(listDoctors, PLACEHOLDER_DOCTORS);

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
      <main className="page-shell">
        <PageIntro eyebrow="Appointments" title="Book an appointment" description="Choose an ophthalmologist, pick a time that suits you, and tell them what you would like to discuss. Your screening results are shared only with the clinician you approve." />
        <div className="portal-grid">
          <section className="panel">
            <div className="panel-head"><div><span>Consultation request</span><h2>When would you like to be seen?</h2></div><CalendarCheck /></div>
            {requested ? (
              <div className="appointment-confirmed"><strong>Request sent</strong><span>The clinic will confirm your appointment and notify you when your clinician accepts.</span><small>You can track it any time from your patient portal.</small><Button variant="outline" className="w-full" onClick={() => setRequested(false)}>Request another appointment</Button></div>
            ) : (
              <form className="booking-form" onSubmit={submit}>
                <div className="field-group"><label htmlFor="clinic">Ophthalmologist</label><select id="clinic" name="doctor">{doctors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.specialty}, {d.clinic}</option>)}</select></div>
                <div className="form-pair"><div className="field-group"><label htmlFor="date">Preferred date</label><Input id="date" name="date" type="date" required defaultValue="2026-10-08" /></div><div className="field-group"><label htmlFor="time">Preferred time</label><Input id="time" name="time" type="time" required defaultValue="10:30" /></div></div>
                <div className="field-group"><label htmlFor="reason">What would you like to discuss?</label><textarea id="reason" name="reason" placeholder="Review my latest retinal screening, discuss next steps…" /></div>
                {error && <p className="form-error" role="alert">{error}</p>}
                <Button size="lg" type="submit" disabled={busy}><Clock3 />Request appointment</Button>
                <p className="form-hint">Requests are held until the clinic confirms your slot.</p>
              </form>
            )}
          </section>
          <aside className="panel">
            <div className="panel-head"><div><span>Good to know</span><h2>Before your visit</h2></div><Stethoscope /></div>
            <ul className="expect-list">
              <li><ShieldCheck /><span>Bring your most recent retinal photographs or screening ID so your clinician can compare results.</span></li>
              <li><ShieldCheck /><span>Dilated examinations can blur near vision for a few hours, so arrange a ride if you can.</span></li>
              <li><ShieldCheck /><span>Share your records only with the clinician you approve, and revoke access whenever you like.</span></li>
            </ul>
            <div className="clinical-note"><span>Screening support, not a diagnosis</span><p>Appointment requests are sent to the clinic, which confirms each slot directly with you.</p></div>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

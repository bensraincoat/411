import { useState } from "react";
import { CalendarPlus, ChevronRight, Clock3, FileText, ScanEye, ShieldCheck, UserRound } from "lucide-react";
import { AppShell, PageIntro } from "../components/AppShell";
import { Button, Input } from "../components/ui";
import { Link } from "../router";
import { errorMessage, listAppointments, listConsents, listDoctors, listMyNotes, listMyScans, requestAppointment, type Appointment } from "../api";
import { useApi } from "../hooks/useApi";
import { PLACEHOLDER_DOCTORS } from "../data/placeholders";

export function Dashboard() {
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState("");
  const { data: scans } = useApi(listMyScans, []);
  const { data: notes } = useApi(listMyNotes, []);
  const { data: consents } = useApi(listConsents, []);
  const { data: doctors } = useApi(listDoctors, PLACEHOLDER_DOCTORS);
  const { data: appointments, setData: setAppointments } = useApi<Appointment[]>(listAppointments, []);

  const careDoctor = consents.find((c) => c.status === "active")?.doctor_name ?? "Dr. Amina Morgan";
  const initials = careDoctor.replace(/^Dr\.\s*/, "").split(" ").map((w) => w[0]).join("").slice(0, 2);
  const upcoming = appointments.find((a) => a.status !== "cancelled");

  async function submitBooking(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBookError("");
    try {
      const appt = await requestAppointment({ doctor_id: String(f.get("doctor")), date: String(f.get("date")), time: String(f.get("time")), reason: String(f.get("reason") ?? "") });
      setAppointments((current) => [appt, ...current]);
      setBooking(false);
    } catch (err) {
      setBookError(errorMessage(err));
    }
  }

  return (
    <AppShell>
      <main className="portal-shell">
        <PageIntro eyebrow="Patient portal" title="Good morning, Patient" description="Your screening history, care team, and next steps—together in one private workspace." />
        <div className="portal-grid">
          <section className="portal-main">
            <div className="quick-action"><div><span>New screening</span><h2>Upload retinal photographs</h2><p>Start a guided review using one of five documented classification models.</p></div><Link className="btn" to="/analyze"><ScanEye />Begin analysis</Link></div>
            <div className="panel">
              <div className="panel-head"><div><span>Screening history</span><h2>Recent retinal images</h2></div><Button variant="ghost" size="sm">View all <ChevronRight /></Button></div>
              {scans.length === 0 ? (
                <div className="empty-history"><div className="mini-retina"><ScanEye /></div><h3>No saved screenings yet</h3><p>Your completed image analyses will appear here with their grade and review status.</p><Link className="btn btn-outline" to="/analyze">Upload first photograph</Link></div>
              ) : (
                <div className="patient-list">{scans.map((s) => <div key={s.id} className="patient-row"><span className={`grade grade-${s.grade}`}>L{s.grade}</span><span><strong>{s.label}</strong><small>{s.model_name} · {new Date(s.created_at).toLocaleDateString()} · {s.status}</small></span></div>)}</div>
              )}
            </div>
            <div className="panel">
              <div className="panel-head"><div><span>Doctor’s notes</span><h2>Care guidance</h2></div><FileText /></div>
              {notes.length === 0 ? (
                <div className="note-placeholder"><ShieldCheck /><div><strong>Notes stay private</strong><p>When your selected ophthalmologist reviews a result, their explanation, preventive guidance, and follow-up advice will appear here.</p></div></div>
              ) : notes.map((n) => <div key={n.id} className="note-placeholder"><FileText /><div><strong>{n.doctor_name ?? "Your ophthalmologist"}</strong><p>{n.note}</p>{n.follow_up && <p><b>Next step:</b> {n.follow_up}</p>}</div></div>)}
            </div>
          </section>
          <aside className="portal-side">
            <div className="panel">
              <div className="panel-head"><div><span>Care team</span><h2>Your ophthalmologist</h2></div><UserRound /></div>
              <div className="doctor-profile"><div className="doctor-avatar">{initials}</div><div><strong>{careDoctor}</strong><span>Retina specialist · VisionCare Clinic</span></div></div>
              <div className="consent-state"><ShieldCheck /><span>You control this clinician’s access to your records.</span></div>
              <Button variant="outline" className="w-full">Change clinician</Button>
            </div>
            <div className="panel">
              <div className="panel-head"><div><span>Appointments</span><h2>Upcoming care</h2></div><Clock3 /></div>
              {upcoming ? <div className="appointment-confirmed"><strong>Consultation {upcoming.status}</strong><span>{upcoming.date} · {upcoming.time}</span><small>{upcoming.status === "confirmed" ? "Confirmed by the clinic" : "Awaiting clinician confirmation"}</small></div> : <p className="muted-copy">No upcoming appointments.</p>}
              <Button className="w-full" onClick={() => setBooking(true)}><CalendarPlus />Book appointment</Button>
            </div>
          </aside>
        </div>
        {booking && (
          <div className="modal-backdrop">
            <form className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title" onSubmit={submitBooking}>
              <button type="button" className="modal-close" onClick={() => setBooking(false)} aria-label="Close">×</button>
              <span>New appointment</span><h2 id="booking-title">Request a consultation</h2>
              <label>Ophthalmologist<select name="doctor">{doctors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>)}</select></label>
              <div className="form-pair"><label>Date<Input name="date" type="date" defaultValue="2026-10-08" /></label><label>Time<Input name="time" type="time" defaultValue="10:30" /></label></div>
              <label>Reason<textarea name="reason" defaultValue="Review my latest retinal screening" /></label>
              {bookError && <p className="form-error" role="alert">{bookError}</p>}
              <Button size="lg" type="submit">Request appointment</Button>
            </form>
          </div>
        )}
      </main>
    </AppShell>
  );
}

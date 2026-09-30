import { useState } from "react";
import { CalendarDays, ChevronRight, CircleAlert, FileText, Search, UsersRound } from "lucide-react";
import { AppShell, PageIntro } from "../components/AppShell";
import { Button, Input } from "../components/ui";
import { errorMessage, getDoctorStats, listSharedPatients, saveDoctorNote, type Patient } from "../api";
import { useApi } from "../hooks/useApi";
import { PLACEHOLDER_PATIENTS, PLACEHOLDER_STATS } from "../data/placeholders";

const initialsOf = (p: Patient) => p.initials ?? p.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export function Doctor() {
  const { data: patients } = useApi(listSharedPatients, PLACEHOLDER_PATIENTS);
  const { data: stats } = useApi(getDoctorStats, PLACEHOLDER_STATS);
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("I reviewed your screening. Please arrange a dilated eye examination so we can confirm these findings and discuss the next step.");
  const [followUp, setFollowUp] = useState("Schedule an in-person retinal assessment within 4 weeks.");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const selected = patients.find((p) => p.id === selectedId) ?? patients[0];
  const visible = patients.filter((p) => `${p.name} ${p.id}`.toLowerCase().includes(query.toLowerCase()));
  const level = selected?.latest_grade ?? 0;
  const confidence = selected?.latest_confidence;

  async function share() {
    if (!selected) return;
    setError("");
    try { await saveDoctorNote(selected.id, note, followUp); setSaved(true); }
    catch (err) { setError(errorMessage(err)); }
  }

  return (
    <AppShell>
      <main className="portal-shell">
        <PageIntro eyebrow="Clinician workspace" title="Retinal review queue" description="View only the patients who have granted you access, review their screenings, and share clinical guidance." />
        <div className="clinician-stats">
          <article><UsersRound /><span>Active patients</span><strong>{stats.active_patients}</strong></article>
          <article><CircleAlert /><span>Awaiting review</span><strong>{stats.awaiting_review}</strong></article>
          <article><CalendarDays /><span>Today’s visits</span><strong>{stats.todays_visits}</strong></article>
        </div>
        <div className="doctor-grid">
          <section className="patient-list panel">
            <div className="panel-head"><div><span>Shared with you</span><h2>Patients</h2></div></div>
            <div className="search-box"><Search /><Input placeholder="Search patients" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
            {visible.map((p) => (
              <button key={p.id} className={selected?.id === p.id ? "patient-row active" : "patient-row"} onClick={() => { setSelectedId(p.id); setSaved(false); }}>
                <span className="patient-avatar">{initialsOf(p)}</span><span><strong>{p.name}</strong><small>{p.id} · {p.latest_scan_at}</small></span><span className={`grade grade-${p.latest_grade ?? 0}`}>L{p.latest_grade ?? 0}</span><ChevronRight />
              </button>
            ))}
          </section>
          {selected && (
            <section className="review-panel panel">
              <div className="review-title"><div><span>Current review</span><h2>{selected.name}</h2><p>{selected.id} · Latest scan</p></div><span className={`grade grade-${level}`}>Level {level}</span></div>
              <div className="scan-detail">
                {selected.latest_image_url ? <img className="fundus-placeholder" src={selected.latest_image_url} alt={`Latest retinal image for ${selected.name}`} /> : <div className="fundus-placeholder"><span /><span /><span /><small>Retinal image preview</small></div>}
                <div><span>Screening result</span><h3>{selected.latest_label}</h3><strong>{confidence !== undefined ? `${Math.round(confidence <= 1 ? confidence * 100 : confidence)}% model confidence` : "Model confidence pending"}</strong><p>{selected.latest_explanation ?? "The model explanation for this scan will appear here once it is returned by the analysis service."}</p></div>
              </div>
              <div className="note-editor">
                <div><FileText /><span>Doctor’s note</span></div>
                <textarea value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }} />
                <Input value={followUp} onChange={(e) => { setFollowUp(e.target.value); setSaved(false); }} />
                {error && <p className="form-error" role="alert">{error}</p>}
                <Button onClick={share}>{saved ? "Note shared" : "Save & share with patient"}</Button>
              </div>
            </section>
          )}
        </div>
        <p className="privacy-line">Patient access is consent-based. Records disappear from this workspace when consent is revoked.</p>
      </main>
    </AppShell>
  );
}

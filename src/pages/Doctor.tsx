import { useEffect, useState } from "react";
import { FileText, ScanEye, Search, ShieldCheck } from "lucide-react";

import { AppShell } from "../components/AppShell";
import { Button, Input } from "../components/ui";
import { Link } from "../router";

import {
  errorMessage,
  listAppointments,
  updateAppointmentStatus,
  type Appointment,
  getDoctorStats,
  listSharedPatients,
  saveDoctorNote,
  type Patient,
} from "../api";

import { useApi } from "../hooks/useApi";
import { ResearchScanImage } from "../components/ResearchScanImage";
import { ResearchScanExplanation } from "../components/ResearchScanExplanation";
import { listPatientResearchScans } from "../api/records";
import type { Scan } from "../api/types";


const initialsOf = (patient: Patient) =>
  patient.initials ??
  patient.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const appointmentStatusLabel: Record<Appointment["status"], string> = {
  requested: "Pending",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};

function formatDay(date: string) {
  const day = new Date(`${date}T12:00:00`);
  return Number.isNaN(day.getTime())
    ? date
    : day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}


// Appointment requests are independent from permission to view retinal scans.
// The backend decides which doctor owns each appointment.
function DoctorAppointmentInbox({ onPendingCount }: { onPendingCount: (count: number) => void }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    listAppointments()
      .then((data) => { if (mounted) setAppointments(data); })
      .catch((err) => { if (mounted) setError(errorMessage(err)); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function decide(appointmentId: string, status: "confirmed" | "declined") {
    if (status === "declined" && !window.confirm("Decline this appointment request?")) {
      return;
    }
    setBusyId(appointmentId);
    setError("");
    try {
      const saved = await updateAppointmentStatus(appointmentId, status);
      setAppointments((previous) => previous.map((appointment) =>
        appointment.id === appointmentId ? { ...appointment, ...saved } : appointment
      ));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const dateKey = (a: Appointment) => `${a.date}T${a.time || "00:00"}`;
  const pending = appointments
    .filter((a) => a.status === "requested")
    .sort((a, b) => dateKey(a).localeCompare(dateKey(b)));
  const now = new Date();
  const currentDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const nextConfirmed = appointments
    .filter((a) => a.status === "confirmed" && dateKey(a) >= `${currentDay}T${currentTime}`)
    .sort((a, b) => dateKey(a).localeCompare(dateKey(b)))[0];
  const other = appointments
    .filter((a) => a.status !== "requested" && a.id !== nextConfirmed?.id)
    .sort((a, b) => dateKey(b).localeCompare(dateKey(a)));

  useEffect(() => { onPendingCount(pending.length); }, [pending.length, onPendingCount]);

  return (
    <div className="appt">
      {loading && <p role="status" className="side-muted">Loading appointments...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loading && !error && appointments.length === 0 && (
        <p className="side-muted">No appointment requests yet.</p>
      )}

      {!loading && appointments.length > 0 && (
        <>
          <div>
            <span className="card-label">Needs your response ({pending.length})</span>
            {pending.length === 0 && <p className="side-muted appt-empty">Nothing waiting.</p>}
            {pending.map((appointment) => (
              <article key={appointment.id} className="appt-row">
                <div className="appt-info">
                  <strong>{appointment.patient_name || "Patient account"}</strong>
                  <small>{formatDay(appointment.date)} at {appointment.time}</small>
                  <small>{appointment.reason?.trim() || "No reason provided"}</small>
                </div>
                <div className="appt-actions">
                  <Button size="sm" disabled={busyId !== null}
                    onClick={() => decide(appointment.id, "confirmed")}>
                    {busyId === appointment.id ? "Saving..." : "Confirm"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busyId !== null}
                    onClick={() => decide(appointment.id, "declined")}>
                    Decline
                  </Button>
                </div>
              </article>
            ))}
          </div>

          {nextConfirmed && (
            <div className="appt-next">
              <span className="card-label">Next confirmed</span>
              <div className="side-row">
                <strong>{nextConfirmed.patient_name || "Patient account"}</strong>
                <span className="status-pill is-confirmed">{formatDay(nextConfirmed.date)}, {nextConfirmed.time}</span>
              </div>
              {nextConfirmed.reason?.trim() && <small>{nextConfirmed.reason}</small>}
            </div>
          )}

          {other.length > 0 && (
            <details className="appt-other">
              <summary>Other appointments ({other.length})</summary>
              {other.map((appointment) => (
                <article key={appointment.id} className="appt-row">
                  <div className="appt-info">
                    <strong>{appointment.patient_name || "Patient account"}</strong>
                    <small>{formatDay(appointment.date)} at {appointment.time}</small>
                  </div>
                  <span className={`status-pill is-${appointment.status}`}>
                    {appointmentStatusLabel[appointment.status]}
                  </span>
                </article>
              ))}
            </details>
          )}
        </>
      )}
    </div>
  );
}

export function Doctor() {
  // Real backend data only.
  const { data: patients } = useApi(
    listSharedPatients,
    []
  );

  const { data: stats } = useApi(
    getDoctorStats,
    {
      active_patients: 0,
      awaiting_review: 0,
      todays_visits: 0,
    }
  );


  const [selectedId, setSelectedId] =
    useState<string>();

  const [query, setQuery] = useState("");

  const [note, setNote] = useState("");

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [researchScans, setResearchScans] = useState<Scan[]>([]);
  const [scansError, setScansError] = useState("");
  const [chosenScanId, setChosenScanId] = useState<string | null>(null);
  const [showAllScans, setShowAllScans] = useState(false);
  const [tab, setTab] = useState<"patients" | "appointments">("patients");
  const [pendingCount, setPendingCount] = useState(0);


  // Select the clicked patient.
  // If none has been clicked yet, use the first real patient.
  const selected =
    patients.find(
      (patient) => patient.id === selectedId
    ) ?? patients[0];


  // Search only through real consented patients.
  const visible = patients.filter((patient) =>
    `${patient.name} ${patient.id}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );


  useEffect(() => {
    if (!selected?.id) {
      setResearchScans([]);
      return;
    }
    let active = true;
    setResearchScans([]);
    setScansError("");
    setShowAllScans(false);
    listPatientResearchScans(selected.id)
      .then((scans) => { if (active) setResearchScans(scans); })
      .catch(() => { if (active) setScansError("Unable to load research history"); });
    return () => { active = false; };
  }, [selected?.id]);

  // Keep the displayed photograph, label, confidence and explanation together.
  // The research history is ordered newest-first by the authenticated Flask API.
  const activeScan = researchScans.find((scan) => scan.id === chosenScanId) ?? researchScans[0];
  const activeScanId = activeScan?.id ?? selected?.latest_scan_id;
  const level = activeScan?.grade ?? selected?.latest_grade;
  const confidence = activeScan?.confidence ?? selected?.latest_confidence;
  const activeLabel = activeScan?.label ?? selected?.latest_label;
  const hasScreening = level !== undefined;
  const visibleScans = showAllScans ? researchScans : researchScans.slice(0, 4);


  async function share() {
    if (!selected) {
      return;
    }

    setError("");

    try {
      await saveDoctorNote(
        selected.id,
        note.trim(),
        "",
        activeScanId
      );

      setSaved(true);
      setNote("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }


  return (
    <AppShell>
      <main className="portal-shell dash">

        <header className="dash-head">
          <div>
            <span className="dash-role">Clinician workspace</span>
            <h1>Patient reviews</h1>

            <p className="stat-line">
              <span><strong>{stats.active_patients}</strong> active patients</span>
              <span><strong>{stats.awaiting_review}</strong> awaiting review</span>
              <span><strong>{stats.todays_visits}</strong> visits today</span>
            </p>
          </div>

          <Link className="btn btn-lg" to="/analyze">
            <ScanEye />
            New screening
          </Link>
        </header>


        <div className="doc-grid">

          {/* ---------- LEFT: patients / appointments ---------- */}
          <section className="panel doc-side">

            <div className="seg seg-wide" role="group" aria-label="Workspace list">
              <button type="button" aria-pressed={tab === "patients"} onClick={() => setTab("patients")}>
                Patients
              </button>
              <button type="button" aria-pressed={tab === "appointments"} onClick={() => setTab("appointments")}>
                Appointments
                {pendingCount > 0 && <span className="count-badge">{pendingCount}</span>}
              </button>
            </div>


            <div hidden={tab !== "patients"} className="doc-pane">
              <div className="search-box">
                <Search />

                <Input
                  placeholder="Search patients"
                  aria-label="Search patients"
                  value={query}
                  onChange={(e) =>
                    setQuery(e.target.value)
                  }
                />
              </div>

              {/* No patients have granted access */}
              {patients.length === 0 ? (

                <div className="empty-history">
                  <div className="mini-retina">
                    <ShieldCheck />
                  </div>

                  <h3>No patients have shared access</h3>

                  <p>
                    Patients who select you as their
                    ophthalmologist will appear here.
                  </p>
                </div>

              ) : visible.length === 0 ? (

                <p className="side-muted">No patients match that search.</p>

              ) : (

                <div className="history-list doc-list">
                  {visible.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      className={`history-row${selected?.id === patient.id ? " is-active" : ""}`}
                      aria-pressed={selected?.id === patient.id}
                      onClick={() => {
                        // Clicking the already selected patient must not clear their scans.
                        // The loading effect only reruns when selected.id changes.
                        if (selected?.id === patient.id) return;
                        if (note.trim() && !window.confirm("Discard your unsaved doctor's note?")) return;
                        setSelectedId(patient.id);
                        setChosenScanId(null);
                        // Switching patients triggers the useEffect above to clear and refetch history.
                        setNote("");
                        setSaved(false);
                        setError("");
                      }}
                    >
                      <span className="patient-avatar">{initialsOf(patient)}</span>

                      <span className="history-text">
                        <strong>{patient.name}</strong>
                        <small>
                          {patient.latest_scan_at
                            ? new Date(patient.latest_scan_at).toLocaleDateString()
                            : "No screening yet"}
                        </small>
                      </span>

                      {patient.latest_grade !== undefined ? (
                        <span className={`grade grade-${patient.latest_grade}`}>
                          L{patient.latest_grade}
                        </span>
                      ) : (
                        <span className="grade">—</span>
                      )}
                    </button>
                  ))}
                </div>

              )}

              <p className="doc-note">
                Access is consent-based. A patient disappears from this list if they revoke consent.
              </p>
            </div>


            <div hidden={tab !== "appointments"} className="doc-pane">
              <DoctorAppointmentInbox onPendingCount={setPendingCount} />
            </div>

          </section>


          {/* ---------- RIGHT: selected patient review ---------- */}
          {selected ? (

            <section className="panel feature-card">

              <div className="review-head">
                <div>
                  <span className="card-label">
                    {activeScan
                      ? `Test from ${new Date(activeScan.created_at).toLocaleString()}`
                      : selected.latest_scan_at
                        ? "Latest saved research test"
                        : "No screening yet"}
                  </span>
                  <h2>{selected.name}</h2>
                </div>

                {hasScreening && level !== undefined ? (
                  <span className={`grade grade-${level}`}>Level {level}</span>
                ) : (
                  <span className="grade">No scan</span>
                )}
              </div>

              {scansError && <p className="form-error" role="alert">{scansError}</p>}

              {hasScreening ? (

                <>
                  <div className="feature-body">

                    {activeScanId ? (
                      <ResearchScanImage key={activeScanId} scanId={activeScanId}
                        className="feature-image" alt={`Experimental retinal image for ${selected.name}`} />
                    ) : (
                      <div className="feature-image feature-image-empty">Retinal image unavailable</div>
                    )}

                    <div className="feature-info">
                      <h3 className="feature-label">{activeLabel ?? "Result pending"}</h3>

                      <p className="feature-confidence">
                        {confidence !== undefined
                          ? `${Math.round(confidence <= 1 ? confidence * 100 : confidence)}% model confidence`
                          : "Model confidence pending"}
                      </p>

                      {activeScanId && level !== undefined && (
                        <ResearchScanExplanation key={activeScanId} scanId={activeScanId}
                          grade={level} label={activeLabel ?? "Research result"} />
                      )}

                      <p className="feature-disclaimer">
                        Experimental research classification. Not a diagnosis or a verified finding.
                      </p>
                    </div>

                  </div>


                  {researchScans.length > 1 && (
                    <div className="scan-picker">
                      <div className="panel-head">
                        <span className="card-label">Saved tests ({researchScans.length})</span>
                        {researchScans.length > 4 && (
                          <Button variant="ghost" size="sm" onClick={() => setShowAllScans((v) => !v)}>
                            {showAllScans ? "Show fewer" : "View all"}
                          </Button>
                        )}
                      </div>

                      <div className="history-list">
                        {visibleScans.map((scan) => (
                          <button
                            key={scan.id}
                            type="button"
                            className={`history-row scan-pick${activeScanId === scan.id ? " is-active" : ""}`}
                            aria-pressed={activeScanId === scan.id}
                            onClick={() => {
                              if (activeScanId !== scan.id && note.trim() && !window.confirm("Discard your unsaved doctor's note?")) return;
                              setChosenScanId(scan.id); setSaved(false); setNote("");
                            }}
                          >
                            <span className="history-text">
                              <strong>{scan.label}</strong>
                              <small>
                                {new Date(scan.created_at).toLocaleString()} · {(scan.confidence * 100).toFixed(1)}% score
                              </small>
                            </span>
                            <span className={`grade grade-${scan.grade}`}>L{scan.grade}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}


                  {/* Optional note editor, collapsed until the clinician needs it. */}
                  <details className="note-details">
                    <summary>Write a note for this patient</summary>
                    <div className="note-fields">
                      <textarea
                        rows={4}
                        placeholder="Write your observations or follow-up instructions..."
                        aria-label="Doctor's note"
                        value={note}
                        onChange={(e) => { setNote(e.target.value); setSaved(false); }}
                      />
                      {error && <p className="form-error" role="alert">{error}</p>}
                      {saved && <p role="status" className="side-muted">Note saved and shared with the patient.</p>}
                      <Button type="button" disabled={!note.trim()} onClick={share}>
                        Save &amp; share with patient
                      </Button>
                    </div>
                  </details>
                </>

              ) : (

                /* Patient has consented but has no scan */
                <div className="empty-history">
                  <div className="mini-retina">
                    <FileText />
                  </div>

                  <h3>No retinal screening yet</h3>

                  <p>
                    This patient has shared access with you but has not completed a screening.
                  </p>
                </div>

              )}

            </section>

          ) : (

            <section className="panel results-empty">
              <div className="mini-retina"><ShieldCheck /></div>
              <h2>No patient selected</h2>
              <p>Patients who share their records with you will appear on the left.</p>
            </section>

          )}

        </div>

      </main>
    </AppShell>
  );
}

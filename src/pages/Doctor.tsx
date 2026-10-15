import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  CircleAlert,
  FileText,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { AppShell, PageIntro } from "../components/AppShell";
import { Button, Input } from "../components/ui";

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
import "./ClinicianCompactHistory.css";


const initialsOf = (patient: Patient) =>
  patient.initials ??
  patient.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();



// Appointment requests are independent from permission to view retinal scans.
// The backend decides which doctor owns each appointment.
function DoctorAppointmentInbox() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAllPending, setShowAllPending] = useState(false);
  const [showOther, setShowOther] = useState(false);

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
  const visiblePending = showAllPending ? pending : pending.slice(0, 2);

  const rowStyle = {
    display: "flex" as const,
    alignItems: "flex-start" as const,
    justifyContent: "space-between" as const,
    gap: 12,
    flexWrap: "wrap" as const,
    borderBottom: "1px solid var(--border)",
    padding: "12px 0"
  };

  return (
    <section className="panel" style={{ marginTop: 22, marginBottom: 18 }}>
      <div className="panel-head">
        <div>
          <span>Appointment management</span>
          <h2>Appointments</h2>
          <p className="muted-copy" style={{ marginTop: 6 }}>
            {pending.length} pending request{pending.length === 1 ? "" : "s"}
            {nextConfirmed ? " | Next confirmed visit below" : ""}
          </p>
        </div>
        <CalendarDays aria-hidden="true" />
      </div>

      {loading && <p role="status" style={{ marginTop: 16 }}>Loading appointments...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loading && !error && appointments.length === 0 && (
        <p className="muted-copy" style={{ marginTop: 16 }}>
          No appointment requests yet. New requests will appear here.
        </p>
      )}

      {!loading && appointments.length > 0 && (
        <>
          {pending.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <strong style={{ display: "block", marginBottom: 2 }}>Needs your response ({pending.length})</strong>
              {visiblePending.map((appointment) => (
                <article key={appointment.id} style={rowStyle}>
                  <div style={{ display: "grid", gap: 3, minWidth: 180, flex: "1 1 240px" }}>
                    <strong>{appointment.patient_name || "Patient account"}</strong>
                    <small>{appointment.date} at {appointment.time}</small>
                    <small style={{ color: "var(--muted-foreground)" }}>
                      {appointment.reason?.trim() || "No reason provided"}
                    </small>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
              {pending.length > 2 && (
                <Button type="button" size="sm" variant="outline"
                  onClick={() => setShowAllPending((v) => !v)}>
                  {showAllPending ? "Show fewer requests" : `Show all pending (${pending.length})`}
                </Button>
              )}
            </div>
          ) : (
            <p className="muted-copy" style={{ marginTop: 12 }}>No requests need a response.</p>
          )}

          {nextConfirmed && (
            <div style={{
              marginTop: 14, padding: "12px 14px", background: "var(--vanilla-soft)",
              borderLeft: "3px solid var(--primary)", borderRadius: 4
            }}>
              <strong style={{ display: "block", marginBottom: 5 }}>Next confirmed appointment</strong>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <strong>{nextConfirmed.patient_name || "Patient account"}</strong>
                  <div style={{ fontSize: 13 }}>{nextConfirmed.date} at {nextConfirmed.time}</div>
                  {nextConfirmed.reason?.trim() && (
                    <small style={{ color: "var(--muted-foreground)" }}>{nextConfirmed.reason}</small>
                  )}
                </div>
                <span className="grade" style={{ alignSelf: "flex-start" }}>Confirmed</span>
              </div>
            </div>
          )}

          {other.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Button type="button" size="sm" variant="outline"
                onClick={() => setShowOther((v) => !v)}>
                {showOther ? "Hide other appointments" : `View other appointments (${other.length})`}
              </Button>
              {showOther && (
                <div style={{ marginTop: 7 }}>
                  {other.map((appointment) => (
                    <article key={appointment.id} style={rowStyle}>
                      <div style={{ display: "grid", gap: 3, flex: "1 1 230px" }}>
                        <strong>{appointment.patient_name || "Patient account"}</strong>
                        <small>{appointment.date} at {appointment.time}</small>
                        {appointment.reason?.trim() && (
                          <small style={{ color: "var(--muted-foreground)" }}>{appointment.reason}</small>
                        )}
                      </div>
                      <span className="grade" style={{ alignSelf: "flex-start" }}>
                        {appointment.status}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
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
      <main className="portal-shell">

        <PageIntro
          eyebrow="Clinician workspace"
          title="Clinician Dashboard"
          description="Manage appointment requests, review retinal screenings shared with you, and provide follow-up guidance."
        />


        {/* Doctor statistics */}
        <DoctorAppointmentInbox />

        <div className="clinician-stats">

          <article>
            <UsersRound />

            <span>
              Active patients
            </span>

            <strong>
              {stats.active_patients}
            </strong>
          </article>


          <article>
            <CircleAlert />

            <span>
              Awaiting review
            </span>

            <strong>
              {stats.awaiting_review}
            </strong>
          </article>


          <article>
            <CalendarDays />

            <span>
              Today’s visits
            </span>

            <strong>
              {stats.todays_visits}
            </strong>
          </article>

        </div>


        <div className="doctor-grid">

          {/* Patient list */}
          <section className="patient-list panel">

            <div className="panel-head">
              <div>
                <span>
                  Shared with you
                </span>

                <h2>
                  Patients
                </h2>
              </div>
            </div>


            <div className="search-box">
              <Search />

              <Input
                placeholder="Search patients"
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

                <h3>
                  No patients have shared access
                </h3>

                <p>
                  Patients who select you as their
                  ophthalmologist will appear here.
                </p>

              </div>

            ) : visible.length === 0 ? (

              <div className="empty-history">

                <Search />

                <h3>
                  No matching patients
                </h3>

                <p>
                  Try searching by a different name
                  or patient ID.
                </p>

              </div>

            ) : (

              visible.map((patient) => {

                const patientHasScan =
                  patient.latest_grade !== undefined;

                return (
                  <button
                    key={patient.id}
                    className={
                      selected?.id === patient.id
                        ? "patient-row active"
                        : "patient-row"
                    }
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

                    <span className="patient-avatar">
                      {initialsOf(patient)}
                    </span>


                    <span>

                      <strong>
                        {patient.name}
                      </strong>

                      <small>
                        {patient.latest_scan_at
                          ? `Latest test: ${new Date(patient.latest_scan_at).toLocaleDateString()}`
                          : "No screening yet"}
                      </small>

                    </span>


                    {patientHasScan ? (

                      <span
                        className={`grade grade-${patient.latest_grade}`}
                      >
                        L{patient.latest_grade}
                      </span>

                    ) : (

                      <span className="grade">
                        —
                      </span>

                    )}


                    <ChevronRight />

                  </button>
                );
              })

            )}

          </section>


          {/* Selected patient review */}
          {selected && (

            <section className="review-panel panel oi-compact-review">

              <div className="review-title">

                <div>
                  <span>
                    Current review
                  </span>

                  <h2>
                    {selected.name}
                  </h2>

                  <p>
                    {activeScan
                      ? `Viewing test from ${new Date(activeScan.created_at).toLocaleString()}`
                      : selected.latest_scan_at
                        ? "Latest saved research test"
                        : "No screening yet"}
                  </p>
                </div>


                {hasScreening && level !== undefined ? (

                  <span
                    className={`grade grade-${level}`}
                  >
                    Level {level}
                  </span>

                ) : (

                  <span className="grade">
                    No scan
                  </span>

                )}

              </div>


              {researchScans.length > 0 && (
                <div className="oi-clinician-history" aria-label="Select a saved research test">
                  <div className="oi-clinician-history-heading">
                    <strong>Saved research tests ({researchScans.length})</strong>
                    <small>Choose a test to view its image, result and AI explanation.</small>
                  </div>
                  <div className="oi-clinician-history-list">
                    {researchScans.map((scan) => (
                      <button
                        key={scan.id}
                        type="button"
                        className={`oi-clinician-history-row ${activeScanId === scan.id ? "is-active" : ""}`}
                        aria-pressed={activeScanId === scan.id}
                        onClick={() => {
                          if (activeScanId !== scan.id && note.trim() && !window.confirm("Discard your unsaved doctor's note?")) return;
                          setChosenScanId(scan.id); setSaved(false); setNote("");
                        }}
                      >
                        <span>{new Date(scan.created_at).toLocaleString()}</span>
                        <strong>Grade {scan.grade}: {scan.label}</strong>
                        <span>{(scan.confidence * 100).toFixed(1)}% score <ChevronRight size={15} aria-hidden="true" /></span>
                      </button>
                    ))}
                  </div>
                  <small>Research classifications only; not clinically verified findings.</small>
                </div>
              )}
              {scansError && <p className="form-error" role="alert">{scansError}</p>}

              {/* Screening exists */}
              {hasScreening ? (

                <>
                  <div className="scan-detail">

                    {activeScanId ? (
                      <ResearchScanImage key={activeScanId} scanId={activeScanId}
                        className="fundus-placeholder" alt={`Experimental retinal image for ${selected.name}`} />
                    ) : (

                      <div className="fundus-placeholder">
                        <span />
                        <span />
                        <span />

                        <small>
                          Retinal image preview
                        </small>
                      </div>

                    )}


                    <div>

                      <span>
                        RETINA26 research result — not a diagnosis
                      </span>

                      <h3>
                        {activeLabel ??
                          "Result pending"}
                      </h3>


                      <strong>
                        {confidence !== undefined
                          ? `${Math.round(
                              confidence <= 1
                                ? confidence * 100
                                : confidence
                            )}% model confidence`
                          : "Model confidence pending"}
                      </strong>


                      <p>
                        {activeScan
                          ? "This is an experimental model classification of the selected saved photograph, not a medical diagnosis."
                          : selected.latest_explanation ?? "Experimental research result; not a medical diagnosis."}
                      </p>

                    </div>

                  </div>


                  {activeScanId && level !== undefined && (
                    <ResearchScanExplanation key={activeScanId} scanId={activeScanId}
                      grade={level} label={activeLabel ?? "Research result"} />
                  )}


                  {/* Optional note editor, collapsed until the clinician needs it. */}
                  <details className="oi-clinician-note-details">
                    <summary>Write a note for this patient</summary>
                    <div className="note-editor oi-clinician-note-editor">
                      <div><FileText /><span>Doctor’s note</span></div>
                      <textarea
                        rows={3}
                        placeholder="Write your observations or follow-up instructions..."
                        aria-label="Doctor's note"
                        value={note}
                        onChange={(e) => { setNote(e.target.value); setSaved(false); }}
                      />
                      {error && <p className="form-error" role="alert">{error}</p>}
                      {saved && <p role="status">Note saved and shared with the patient.</p>}
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

                  <h3>
                    No retinal screening available
                  </h3>

                  <p>
                    This patient has granted you access,
                    but they have not completed a retinal
                    screening yet.
                  </p>

                </div>

              )}

            </section>

          )}

        </div>


        <p className="privacy-line">
          Patient access is consent-based. Records
          disappear from this workspace when consent
          is revoked.
        </p>

      </main>
    </AppShell>
  );
}
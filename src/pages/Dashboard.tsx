import {
  removeNoteFromPatientView,
  listMyNotifications,
  markNotificationAsRead,
  listMyRescheduleProposals,
  respondToRescheduleProposal,
  type PatientNotification,
  type RescheduleProposal,
} from "../api/records";


import { ResearchScanImage } from "../components/ResearchScanImage";
import { ResearchScanExplanation } from "../components/ResearchScanExplanation";
import { PatientGreeting } from "../components/PatientDashboardEnhancements";
import { useState, type FormEvent } from "react";
import { Bell, CalendarPlus, ScanEye } from "lucide-react";

import { AppShell } from "../components/AppShell";
import { Button, Input } from "../components/ui";
import { Link } from "../router";


import {
  errorMessage,
  listAppointments,
  listConsents,
  listDoctors,
  listMyNotes,
  listMyScans,
  requestAppointment,
  setConsent,
  type Appointment,
} from "../api";

import { useApi } from "../hooks/useApi";


const appointmentStatusLabel: Record<Appointment["status"], string> = {
  requested: "Pending",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};

function formatAppointmentDay(date: string) {
  const day = new Date(`${date}T12:00:00`);
  return Number.isNaN(day.getTime())
    ? date
    : day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function Dashboard() {
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState("");

  const [clinicianPicker, setClinicianPicker] = useState(false);
  const [clinicianError, setClinicianError] = useState("");
  const [savingDoctorId, setSavingDoctorId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const { data: scans } = useApi(listMyScans, []);
  const [showAllScans, setShowAllScans] = useState(false);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

  // Newest first; the featured card shows the latest unless the patient picks another.
  const sortedScans = [...scans].sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? "")
  );
  const featuredScan =
    sortedScans.find((scan) => scan.id === selectedScanId) ?? sortedScans[0];
  const { data: notes, setData: setNotes } = useApi(listMyNotes, []);

  const {
    data: consents,
    setData: setConsents,
  } = useApi(listConsents, []);

  const { data: doctors } = useApi(listDoctors, []);

  const {
    data: appointments,
    setData: setAppointments,
  } = useApi<Appointment[]>(listAppointments, []);

  const {
    data: notifications,
    setData: setNotifications,
  } = useApi<PatientNotification[]>(
    listMyNotifications,
    []);



  const {
    data: rescheduleProposals,
    setData: setRescheduleProposals,
  } = useApi<RescheduleProposal[]>(
    listMyRescheduleProposals,
    []
  );


async function handleRescheduleResponse(
  proposal: RescheduleProposal,
  accept: boolean
) {
  try {
    await respondToRescheduleProposal(proposal.id, accept);

    setRescheduleProposals(
      rescheduleProposals.filter((item) => item.id !== proposal.id)
    );

    if (accept) {
      setAppointments(
        appointments.map((appointment) =>
          appointment.id === proposal.appointment_id
            ? {
                ...appointment,
                date: proposal.proposed_date,
                time: proposal.proposed_time,
                status: "confirmed" as const,
              }
            : appointment
        )
      );
    }
  } catch (error) {
    alert(errorMessage(error));
  }
}


  async function handleMarkAsRead(notificationId: string) {
    try {
      await markNotificationAsRead(notificationId);

      setNotifications(
        notifications.map((notification) =>
          notification.id === notificationId
            ? { ...notification, is_read: 1 }
            : notification
        )
      );
    } catch (error) {
      alert(errorMessage(error));
    }
  }


  const [showAllNotes, setShowAllNotes] = useState(false);
  const [removingNoteId, setRemovingNoteId] = useState<string | null>(null);
  const [noteError, setNoteError] = useState("");

  const sortedNotes = [...notes].sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? "")
  );
  const visibleNotes = showAllNotes ? sortedNotes : sortedNotes.slice(0, 1);

  async function removeNoteFromView(noteId: string) {
    if (!window.confirm(
      "Remove this note from your patient portal? The original clinical record will be retained."
    )) return;

    setNoteError("");
    setRemovingNoteId(noteId);
    try {
      await removeNoteFromPatientView(noteId);
      setNotes((current) => current.filter((entry) => entry.id !== noteId));
    } catch (err) {
      setNoteError(errorMessage(err));
    } finally {
      setRemovingNoteId(null);
    }
  }




  // -------------------------------------------------
  // Current clinician
  // -------------------------------------------------

  const activeConsent = consents.find(
    (consent) => consent.status === "active"
  );

  const selectedDoctor = activeConsent
    ? doctors.find(
        (doctor) => doctor.id === activeConsent.doctor_id
      )
    : undefined;

  const careDoctorName =
    selectedDoctor?.name ??
    activeConsent?.doctor_name ??
    null;

  const careDoctorDetails = selectedDoctor
    ? `${selectedDoctor.specialty} · ${selectedDoctor.clinic}`
    : "Your selected ophthalmologist";

  const initials = careDoctorName
    ? careDoctorName
        .replace(/^Dr\.\s*/i, "")
        .split(" ")
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "";

  const today = new Date();
  const localToday = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
  const upcoming = [...appointments]
    .filter((item) => (item.status === "requested" || item.status === "confirmed") && item.date >= localToday)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0];

  // With nothing upcoming, still surface a request the clinic declined or cancelled.
  const mostRecentRequest = [...appointments].sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? "")
  )[0];
  const nextAppointment =
    upcoming ??
    (mostRecentRequest && (mostRecentRequest.status === "declined" || mostRecentRequest.status === "cancelled")
      ? mostRecentRequest
      : undefined);


  // -------------------------------------------------
  // Appointment booking
  // -------------------------------------------------

  async function submitBooking(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    const form = new FormData(e.currentTarget);

    setBookError("");

    try {
      const appointment = await requestAppointment({
        doctor_id: String(form.get("doctor")),
        date: String(form.get("date")),
        time: String(form.get("time")),
        reason: String(form.get("reason") ?? ""),
      });

      setAppointments((current) => [
        appointment,
        ...current,
      ]);

      setBooking(false);
    } catch (err) {
      setBookError(errorMessage(err));
    }
  }


  // -------------------------------------------------
  // Clinician selection
  // -------------------------------------------------

  async function chooseClinician(doctorId: string) {
    setClinicianError("");
    setSavingDoctorId(doctorId);

    try {
      const updatedConsent = await setConsent(
        doctorId,
        "active"
      );

      // Update the dashboard immediately without
      // requiring a page refresh.
      setConsents([updatedConsent]);

      setClinicianPicker(false);
    } catch (err) {
      setClinicianError(errorMessage(err));
    } finally {
      setSavingDoctorId(null);
    }
  }

  async function removeClinician() {
  if (!activeConsent) {
    return;
  }

  const confirmed = window.confirm(
    "Remove this clinician? They will no longer have access to your screening records."
  );

  if (!confirmed) {
    return;
  }

  setClinicianError("");
  setSavingDoctorId(activeConsent.doctor_id);

  try {
    const updatedConsent = await setConsent(
      activeConsent.doctor_id,
      "revoked"
    );

    setConsents([updatedConsent]);
    setClinicianPicker(false);
  } catch (err) {
    setClinicianError(errorMessage(err));
  } finally {
    setSavingDoctorId(null);
  }
}

  return (
    <AppShell>
      <main className="portal-shell dash">

        <header className="dash-head">
          <div>
            <span className="dash-role">Patient portal</span>
            <h1><PatientGreeting /></h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "relative" }}>
            <button
              type="button"
              className="btn"
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label="Notifications"
            >
              <Bell size={20} />
              {notifications.filter((n) => n.is_read === 0).length}
            </button>

            {showNotifications && (
              <div
                className="panel"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: "340px",
                  maxWidth: "90vw",
                  maxHeight: "320px",
                  overflowY: "auto",
                  padding: "16px",
                  zIndex: 20,
                }}
              >
                <h3>Notifications</h3>

                {notifications.length === 0 ? (
                  <p>No Notifications yet.</p>
                ) : (
                  notifications.map((notification) => (
                    <div key={notification.id} style={{ marginTop: "12px" }}>
                      <strong>{notification.title}</strong>
                      <p>{notification.message}</p>
                      {notification.is_read=== 0 && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => void handleMarkAsRead(notification.id)}
                          style={{ marginTop: "8px" }}
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            <Link className="btn" to="/analyze">
              <ScanEye />
              New screening
            </Link>
          </div>
        </header>

        <div className="dash-grid">

          {/* ---------- MAIN: latest result, then history ---------- */}
          <section className="dash-main">

            <article className="panel feature-card" aria-label="Screening result">
              {!featuredScan ? (
                <div className="empty-history">
                  <div className="mini-retina">
                    <ScanEye />
                  </div>
                  <h2>No screenings yet</h2>
                  <p>Upload a retinal photograph and your result will show up here.</p>
                  <Link className="btn" to="/analyze">Start your first screening</Link>
                </div>
              ) : (
                <>
                  <div className="feature-meta">
                    <span className="card-label">
                      {featuredScan.id === sortedScans[0].id ? "Latest result" : "Selected result"}
                    </span>
                    <span>{new Date(featuredScan.created_at).toLocaleString()}</span>
                  </div>

                  <div className="feature-body">
                    <ResearchScanImage
                      scanId={featuredScan.id}
                      alt={`Retinal image ${featuredScan.filename || featuredScan.id}`}
                      className="feature-image"
                    />

                    <div className="feature-info">
                      <span className={`grade grade-${featuredScan.grade}`}>
                        Level {featuredScan.grade}
                      </span>
                      <h2>{featuredScan.label}</h2>
                      <p className="feature-confidence">
                        {(featuredScan.confidence * 100).toFixed(1)}% model confidence
                      </p>

                      <ResearchScanExplanation
                        scanId={featuredScan.id}
                        grade={featuredScan.grade}
                        label={featuredScan.label}
                      />

                      <p className="feature-disclaimer">
                        Experimental research result. Not a diagnosis.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </article>

            {sortedScans.length > 1 && (
              <article className="panel">
                <div className="panel-head">
                  <h2 className="card-title">History</h2>
                  {sortedScans.length > 4 && (
                    <Button variant="ghost" size="sm" onClick={() => setShowAllScans((v) => !v)}>
                      {showAllScans ? "Show fewer" : `View all (${sortedScans.length})`}
                    </Button>
                  )}
                </div>

                <div className="history-list">
                  {(showAllScans ? sortedScans : sortedScans.slice(0, 4)).map((scan) => (
                    <button
                      key={scan.id}
                      type="button"
                      className={`history-row${scan.id === featuredScan?.id ? " is-active" : ""}`}
                      onClick={() => setSelectedScanId(scan.id)}
                      aria-pressed={scan.id === featuredScan?.id}
                    >
                      <ResearchScanImage
                        scanId={scan.id}
                        alt=""
                        className="history-thumb"
                      />
                      <span className="history-text">
                        <strong>{scan.label}</strong>
                        <small>{new Date(scan.created_at).toLocaleDateString()}</small>
                      </span>
                      <span className={`grade grade-${scan.grade}`}>L{scan.grade}</span>
                    </button>
                  ))}
                </div>
              </article>
            )}
          </section>


          {/* ---------- SIDE: appointment, care team, notes ---------- */}
          <aside className="dash-side">

            <article className="panel">
              <h2 className="card-title">Next appointment</h2>

              {nextAppointment ? (
                <div className="side-block">
                  <div className="side-row">
                    <strong>{nextAppointment.doctor_name || "Your ophthalmologist"}</strong>
                    <span className={`status-pill is-${nextAppointment.status}`}>
                      {appointmentStatusLabel[nextAppointment.status]}
                    </span>
                  </div>
                  <span className="side-muted">
                    {formatAppointmentDay(nextAppointment.date)} at {nextAppointment.time}
                  </span>
                </div>
              ) : (
                <p className="side-muted side-block">Nothing scheduled.</p>
              )}
              {rescheduleProposals.length > 0 && (
                <div className="side-block">
                  <h3>Proposed Appointment Changes</h3>

                  {rescheduleProposals.map((proposal) => (
                    <div key={proposal.id} style={{ marginTop: "16px" }}>
                      <p>
                        <strong>Doctor:</strong> {proposal.doctor_name}
                      </p>

                      <p>
                        <strong>Original:</strong> {(proposal.current_date)} at {" "}
                        {(proposal.current_time)}
                      </p>

                      <p>
                        <strong>Proposed:</strong> {(proposal.proposed_date)} at {" "}
                        {(proposal.proposed_time)}
                      </p>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        <Button
                          size="sm"
                          onClick={() => void handleRescheduleResponse(proposal, true)}
                        >
                          Accept New Time
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleRescheduleResponse(proposal, false)}
                        >
                          Decline New Time
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={() => setBooking(true)}>
                <CalendarPlus />
                Book appointment
              </Button>
            </article>


            <article className="panel">
              <div className="panel-head">
                <h2 className="card-title">Care team</h2>
                <Button variant="ghost" size="sm" onClick={() => setClinicianPicker(true)}>
                  {careDoctorName ? "Change" : "Choose"}
                </Button>
              </div>

              {careDoctorName ? (
                <div className="doctor-profile">
                  <div className="doctor-avatar">{initials}</div>
                  <div>
                    <strong>{careDoctorName}</strong>
                    <span>{careDoctorDetails}</span>
                  </div>
                </div>
              ) : (
                <p className="side-muted side-block">
                  Choose an ophthalmologist to share your results with.
                </p>
              )}
            </article>


            <article className="panel">
              <div className="panel-head">
                <h2 className="card-title">Doctor's notes</h2>
                {notes.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => setShowAllNotes((value) => !value)}>
                    {showAllNotes ? "Latest only" : `All (${notes.length})`}
                  </Button>
                )}
              </div>

              {noteError && <p className="form-error" role="alert">{noteError}</p>}

              {notes.length === 0 ? (
                <p className="side-muted side-block">No notes yet.</p>
              ) : (
                visibleNotes.map((note) => (
                  <div key={note.id} className="note-item">
                    <div className="side-row">
                      <strong>{note.doctor_name ?? "Your clinician"}</strong>
                      {note.created_at && (
                        <span className="side-muted">{new Date(note.created_at).toLocaleDateString()}</span>
                      )}
                    </div>
                    <p>{note.note}</p>
                    {note.follow_up && <p><b>Next step:</b> {note.follow_up}</p>}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={removingNoteId === note.id}
                      onClick={() => removeNoteFromView(note.id)}
                    >
                      {removingNoteId === note.id ? "Removing..." : "Remove from my portal"}
                    </Button>
                  </div>
                ))
              )}
            </article>

          </aside>

        </div>


        {/* ---------- CHOOSE CLINICIAN MODAL ---------- */}
        {clinicianPicker && (
          <div className="modal-backdrop">
            <div
              className="booking-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="clinician-title"
            >
              <button
                type="button"
                className="modal-close"
                onClick={() => setClinicianPicker(false)}
                aria-label="Close"
              >
                ×
              </button>

              <h2 id="clinician-title">Choose your ophthalmologist</h2>

              <p className="muted-copy">
                They can review your screening results and leave care guidance.
                You control this access and can remove it at any time.
              </p>

              {doctors.length === 0 ? (
                <p className="side-muted">No registered ophthalmologists are available yet.</p>
              ) : (
                <div className="history-list">
                  {doctors.map((doctor) => {
                    const doctorInitials = doctor.name
                      .replace(/^Dr\.\s*/i, "")
                      .split(" ")
                      .map((word) => word[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    const isCurrent = activeConsent?.doctor_id === doctor.id;

                    return (
                      <div key={doctor.id} className="history-row">
                        <div className="doctor-avatar">{doctorInitials}</div>

                        <span className="history-text">
                          <strong>{doctor.name}</strong>
                          <small>{doctor.specialty} · {doctor.clinic}</small>
                        </span>

                        <Button
                          type="button"
                          size="sm"
                          variant={isCurrent ? "outline" : "default"}
                          disabled={isCurrent || savingDoctorId === doctor.id}
                          onClick={() => chooseClinician(doctor.id)}
                        >
                          {isCurrent ? "Selected" : savingDoctorId === doctor.id ? "Saving..." : "Select"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {clinicianError && <p className="form-error" role="alert">{clinicianError}</p>}

              {activeConsent && (
                <Button type="button" variant="ghost" className="danger-link" onClick={removeClinician}>
                  Remove my current clinician
                </Button>
              )}
            </div>
          </div>
        )}


        {/* ---------- APPOINTMENT MODAL ---------- */}
        {booking && (
          <div className="modal-backdrop">
            <form
              className="booking-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="booking-title"
              onSubmit={submitBooking}
            >
              <button
                type="button"
                className="modal-close"
                onClick={() => setBooking(false)}
                aria-label="Close"
              >
                ×
              </button>

              <h2 id="booking-title">Request a consultation</h2>

              <label>
                Ophthalmologist
                <select name="doctor" defaultValue={activeConsent?.doctor_id}>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} — {doctor.specialty}
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-pair">
                <label>
                  Date
                  <Input name="date" type="date" min={localToday} required />
                </label>

                <label>
                  Time
                  <Input name="time" type="time" defaultValue="10:30" />
                </label>
              </div>

              <label>
                Reason
                <textarea
                  name="reason"
                  defaultValue="Review my latest retinal screening"
                />
              </label>

              {bookError && <p className="form-error" role="alert">{bookError}</p>}

              <Button size="lg" type="submit">
                Request appointment
              </Button>
            </form>
          </div>
        )}
      </main>
    </AppShell>
  );
}

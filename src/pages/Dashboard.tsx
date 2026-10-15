import { removeNoteFromPatientView } from "../api/records";
import { ResearchScanImage } from "../components/ResearchScanImage";
import { ResearchScanExplanation } from "../components/ResearchScanExplanation";
import { PatientGreeting, AppointmentStatusOverview } from "../components/PatientDashboardEnhancements";
import { useState, type FormEvent } from "react";
import {
  CalendarPlus,
  ChevronRight,
  Clock3,
  FileText,
  ScanEye,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { AppShell, PageIntro } from "../components/AppShell";
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


export function Dashboard() {
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState("");

  const [clinicianPicker, setClinicianPicker] = useState(false);
  const [clinicianError, setClinicianError] = useState("");
  const [savingDoctorId, setSavingDoctorId] = useState<string | null>(null);

  const { data: scans } = useApi(listMyScans, []);
  const [showAllScans, setShowAllScans] = useState(false);
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
      <main className="portal-shell">

        <PageIntro
          eyebrow="Patient portal"
          title={<PatientGreeting />}
          description="Your screening history, care team, and next steps—together in one private workspace."
        />


        <AppointmentStatusOverview />

        <div className="portal-grid">

          {/* LEFT SIDE */}
          <section className="portal-main">

            {/* New screening */}
            <div className="quick-action">
              <div>
                <span>New screening</span>

                <h2>
                  Upload retinal photographs
                </h2>

                <p>
                  Run RETINA26 research tests on non-identifiable fundus photographs and save experimental results to your history.
                </p>
              </div>

              <Link
                className="btn"
                to="/analyze"
              >
                <ScanEye />
                Begin openI scan
              </Link>
            </div>


            {/* Screening history */}
            <div className="panel">

              <div className="panel-head">
                <div>
                  <span>Screening history</span>
                  <h2>Recent retinal images</h2>
                </div>

                {scans.length > 3 && (
                  <Button variant="ghost" size="sm" onClick={() => setShowAllScans((v) => !v)}>
                    {showAllScans ? "Show recent" : "View all"}
                    <ChevronRight />
                  </Button>
                )}
              </div>


              {scans.length === 0 ? (

                <div className="empty-history">

                  <div className="mini-retina">
                    <ScanEye />
                  </div>

                  <h3>
                    No research screenings saved yet
                  </h3>

                  <p>
                    Your experimental RETINA26 results will appear here once you run a test. They are not medical diagnoses.
                  </p>

                  <Link
                    className="btn btn-outline"
                    to="/analyze"
                  >
                    Begin first openI scan
                  </Link>

                </div>

              ) : (

                <div className="patient-list">

                  {(showAllScans ? scans : scans.slice(0, 3)).map((scan) => (
                    <article key={scan.id} className="patient-row" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 90, flexShrink: 0 }}>
                        <ResearchScanImage scanId={scan.id} alt={`Research retinal image ${scan.filename || scan.id}`} />
                      </div>
                      <span className={`grade grade-${scan.grade}`}>L{scan.grade}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong>{scan.label}</strong>
                        <small style={{ display: "block" }}>
                          {scan.model_name} · {new Date(scan.created_at).toLocaleString()} · {(scan.confidence * 100).toFixed(1)}% confidence
                        </small>
                        <small style={{ display: "block" }}>Experimental research result — not a diagnosis</small>
                        <ResearchScanExplanation scanId={scan.id} grade={scan.grade} label={scan.label} />
                      </div>
                    </article>
                  ))}

                </div>

              )}

            </div>


            {/* Doctor notes */}
            <div className="panel">
              <div className="panel-head">
                <div>
                  <span>Doctor's notes</span>
                  <h2>Care guidance</h2>
                </div>
                <FileText />
              </div>

              <p className="muted-copy" style={{ marginTop: 12 }}>
                Recent guidance appears first. You can remove individual notes from
                your portal without altering the clinician's original record.
              </p>
              {noteError && <p className="form-error" role="alert">{noteError}</p>}

              {notes.length === 0 ? (
                <div className="note-placeholder">
                  <ShieldCheck />
                  <div>
                    <strong>No notes in your portal</strong>
                    <p>Notes shared by your clinician will appear here.</p>
                  </div>
                </div>
              ) : (
                <>
                  {visibleNotes.map((note) => (
                    <article key={note.id} className="note-placeholder" style={{ alignItems: "flex-start" }}>
                      <FileText />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <strong>{note.doctor_name ?? "Your clinician"}</strong>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={removingNoteId === note.id}
                            onClick={() => removeNoteFromView(note.id)}
                          >
                            {removingNoteId === note.id ? "Removing..." : "Remove note"}
                          </Button>
                        </div>
                        {note.created_at && (
                          <small style={{ display: "block", marginTop: 3, color: "var(--muted-foreground)" }}>
                            {new Date(note.created_at).toLocaleString()}
                          </small>
                        )}
                        <p>{note.note}</p>
                        {note.follow_up && <p><b>Next step:</b> {note.follow_up}</p>}
                      </div>
                    </article>
                  ))}
                  {notes.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllNotes((value) => !value)}
                    >
                      {showAllNotes ? "Show latest note" : `Show all notes (${notes.length})`}
                    </Button>
                  )}
                </>
              )}
            </div>
          </section>


          {/* RIGHT SIDE */}
          <aside className="portal-side">

            {/* Care team */}
            <div className="panel">

              <div className="panel-head">

                <div>
                  <span>Care team</span>
                  <h2>Your ophthalmologist</h2>
                </div>

                <UserRound />

              </div>


              {careDoctorName ? (

                <>
                  <div className="doctor-profile">

                    <div className="doctor-avatar">
                      {initials}
                    </div>

                    <div>

                      <strong>
                        {careDoctorName}
                      </strong>

                      <span>
                        {careDoctorDetails}
                      </span>

                    </div>

                  </div>


                  <div className="consent-state">

                    <ShieldCheck />

                    <span>
                      You control this clinician’s access
                      to your records.
                    </span>

                  </div>


                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      setClinicianPicker(true)
                    }
                  >
                    Change clinician
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={removeClinician}
                  >
                    Remove clinician
                  </Button>

                </>

              ) : (

                <>
                  <div className="note-placeholder">

                    <UserRound />

                    <div>

                      <strong>
                        No ophthalmologist selected
                      </strong>

                      <p>
                        Choose a clinician to share your
                        screening records and receive care
                        guidance.
                      </p>

                    </div>

                  </div>


                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      setClinicianPicker(true)
                    }
                  >
                    Choose clinician
                  </Button>
                </>

              )}

            </div>


            {/* Appointments */}
            <div className="panel">

              <div className="panel-head">

                <div>
                  <span>Appointments</span>
                  <h2>Upcoming care</h2>
                </div>

                <Clock3 />

              </div>


              {upcoming ? (

                <div className="appointment-confirmed">

                  <strong>
                    Consultation {upcoming.status}
                  </strong>

                  <span>
                    {upcoming.date} · {upcoming.time}
                  </span>

                  <small>
                    {upcoming.status === "confirmed"
                      ? "Confirmed by the clinic"
                      : "Awaiting clinician confirmation"}
                  </small>

                </div>

              ) : (

                <p className="muted-copy">
                  No upcoming appointments.
                </p>

              )}


              <Button
                className="w-full"
                onClick={() => setBooking(true)}
              >
                <CalendarPlus />
                Book appointment
              </Button>

            </div>

          </aside>

        </div>


        {/* -------------------------------------------------
            CHOOSE CLINICIAN MODAL
        ------------------------------------------------- */}

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
                onClick={() =>
                  setClinicianPicker(false)
                }
                aria-label="Close"
              >
                ×
              </button>


              <span>
                Care team
              </span>

              <h2 id="clinician-title">
                Choose your ophthalmologist
              </h2>

              <p className="muted-copy">
                Selecting a clinician allows them to review
                your screening information and provide care
                guidance.
              </p>


              {doctors.length === 0 ? (

                <div className="note-placeholder">

                  <UserRound />

                  <div>
                    <strong>
                      No clinicians available
                    </strong>

                    <p>
                      No registered ophthalmologists are
                      currently available.
                    </p>
                  </div>

                </div>

              ) : (

                <div className="patient-list">

                  {doctors.map((doctor) => {

                    const doctorInitials = doctor.name
                      .replace(/^Dr\.\s*/i, "")
                      .split(" ")
                      .map((word) => word[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    const isCurrent =
                      activeConsent?.doctor_id === doctor.id;

                    return (

                      <div
                        key={doctor.id}
                        className="patient-row"
                      >

                        <div className="doctor-avatar">
                          {doctorInitials}
                        </div>


                        <span>

                          <strong>
                            {doctor.name}
                          </strong>

                          <small>
                            {doctor.specialty}
                            {" · "}
                            {doctor.clinic}
                          </small>

                        </span>


                        <Button
                          type="button"
                          size="sm"
                          variant={
                            isCurrent
                              ? "outline"
                              : "default"
                          }
                          disabled={
                            isCurrent ||
                            savingDoctorId === doctor.id
                          }
                          onClick={() =>
                            chooseClinician(doctor.id)
                          }
                        >

                          {isCurrent
                            ? "Selected"
                            : savingDoctorId === doctor.id
                            ? "Saving..."
                            : "Select"}

                        </Button>

                      </div>

                    );
                  })}

                </div>

              )}


              {clinicianError && (

                <p
                  className="form-error"
                  role="alert"
                >
                  {clinicianError}
                </p>

              )}

            </div>

          </div>

        )}


        {/* -------------------------------------------------
            APPOINTMENT MODAL
        ------------------------------------------------- */}

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
                onClick={() =>
                  setBooking(false)
                }
                aria-label="Close"
              >
                ×
              </button>


              <span>
                New appointment
              </span>

              <h2 id="booking-title">
                Request a consultation
              </h2>


              <label>
                Ophthalmologist

                <select name="doctor">

                  {doctors.map((doctor) => (

                    <option
                      key={doctor.id}
                      value={doctor.id}
                    >
                      {doctor.name} — {doctor.specialty}
                    </option>

                  ))}

                </select>

              </label>


              <div className="form-pair">

                <label>
                  Date

                  <Input
                    name="date"
                    type="date"
                    min={localToday}
                    required
                  />
                </label>


                <label>
                  Time

                  <Input
                    name="time"
                    type="time"
                    defaultValue="10:30"
                  />
                </label>

              </div>


              <label>
                Reason

                <textarea
                  name="reason"
                  defaultValue="Review my latest retinal screening"
                />
              </label>


              {bookError && (

                <p
                  className="form-error"
                  role="alert"
                >
                  {bookError}
                </p>

              )}


              <Button
                size="lg"
                type="submit"
              >
                Request appointment
              </Button>

            </form>

          </div>

        )}
      </main>
    </AppShell>
  );
}
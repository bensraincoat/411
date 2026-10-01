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
  const { data: notes } = useApi(listMyNotes, []);

  const {
    data: consents,
    setData: setConsents,
  } = useApi(listConsents, []);

  const { data: doctors } = useApi(listDoctors, []);

  const {
    data: appointments,
    setData: setAppointments,
  } = useApi<Appointment[]>(listAppointments, []);


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

  const upcoming = appointments.find(
    (appointment) => appointment.status !== "cancelled"
  );


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
          title="Good morning, Patient"
          description="Your screening history, care team, and next steps—together in one private workspace."
        />


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
                  Start a guided review using one of five
                  documented classification models.
                </p>
              </div>

              <Link
                className="btn"
                to="/analyze"
              >
                <ScanEye />
                Begin analysis
              </Link>
            </div>


            {/* Screening history */}
            <div className="panel">

              <div className="panel-head">
                <div>
                  <span>Screening history</span>
                  <h2>Recent retinal images</h2>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                >
                  View all
                  <ChevronRight />
                </Button>
              </div>


              {scans.length === 0 ? (

                <div className="empty-history">

                  <div className="mini-retina">
                    <ScanEye />
                  </div>

                  <h3>
                    No saved screenings yet
                  </h3>

                  <p>
                    Your completed image analyses will appear
                    here with their grade and review status.
                  </p>

                  <Link
                    className="btn btn-outline"
                    to="/analyze"
                  >
                    Upload first photograph
                  </Link>

                </div>

              ) : (

                <div className="patient-list">

                  {scans.map((scan) => (

                    <div
                      key={scan.id}
                      className="patient-row"
                    >

                      <span
                        className={`grade grade-${scan.grade}`}
                      >
                        L{scan.grade}
                      </span>

                      <span>
                        <strong>
                          {scan.label}
                        </strong>

                        <small>
                          {scan.model_name}
                          {" · "}
                          {new Date(
                            scan.created_at
                          ).toLocaleDateString()}
                          {" · "}
                          {scan.status}
                        </small>
                      </span>

                    </div>

                  ))}

                </div>

              )}

            </div>


            {/* Doctor notes */}
            <div className="panel">

              <div className="panel-head">
                <div>
                  <span>Doctor’s notes</span>
                  <h2>Care guidance</h2>
                </div>

                <FileText />
              </div>


              {notes.length === 0 ? (

                <div className="note-placeholder">

                  <ShieldCheck />

                  <div>
                    <strong>
                      Notes stay private
                    </strong>

                    <p>
                      When your selected ophthalmologist
                      reviews a result, their explanation,
                      preventive guidance, and follow-up
                      advice will appear here.
                    </p>
                  </div>

                </div>

              ) : (

                notes.map((note) => (

                  <div
                    key={note.id}
                    className="note-placeholder"
                  >

                    <FileText />

                    <div>

                      <strong>
                        {note.doctor_name ??
                          "Your ophthalmologist"}
                      </strong>

                      <p>
                        {note.note}
                      </p>

                      {note.follow_up && (
                        <p>
                          <b>Next step:</b>{" "}
                          {note.follow_up}
                        </p>
                      )}

                    </div>

                  </div>

                ))

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
                    defaultValue="2026-10-08"
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
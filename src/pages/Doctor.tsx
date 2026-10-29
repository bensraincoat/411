import { useState } from "react";
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
  getDoctorStats,
  listAppointments,
  updateAppointmentStatus,
  rescheduleAppointment,
  listSharedPatients,
  saveDoctorNote,
  type Appointment,
  type Patient,
} from "../api";

import { useApi } from "../hooks/useApi";


const initialsOf = (patient: Patient) =>
  patient.initials ??
  patient.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();


export function Doctor() {
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
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

  const { data: appointments, setData: setAppointments } = useApi<Appointment[]>(
    listAppointments,
    []
  );

  const handleAppointmentStatus = async (
    appointmentId: string,
    status: "confirmed" | "declined"
  ) => {
    try {
      await updateAppointmentStatus(appointmentId, status);

      setAppointments((current) =>
        current.map((appointment) =>
          appointment.id === appointmentId
            ? { ...appointment, status }
            : appointment
        )
      );
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const handleReschedule = async (
    appointmentId: string,
    newDate: string,
    newTime: string
  ) => {
    try {
      await rescheduleAppointment(appointmentId, newDate, newTime);

      setAppointments((current) =>
        current.map((appointment) =>
          appointment.id === appointmentId
            ? {
              ...appointment,
              date: newDate,
              time: newTime,
              status: "confirmed"
            }
            : appointment
        )
      );
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const [selectedId, setSelectedId] =
    useState<string>();

  const [query, setQuery] = useState("");

  const [note, setNote] = useState(
    "I reviewed your screening. Please arrange a dilated eye examination so we can confirm these findings and discuss the next step."
  );

  const [followUp, setFollowUp] = useState(
    "Schedule an in-person retinal assessment within 4 weeks."
  );

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");


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


  const hasScreening =
    selected?.latest_grade !== undefined;

  const level =
    selected?.latest_grade;

  const confidence =
    selected?.latest_confidence;


  async function share() {
    if (!selected) {
      return;
    }

    setError("");

    try {
      await saveDoctorNote(
        selected.id,
        note,
        followUp
      );

      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }


  return (
    <AppShell>
      <main className="portal-shell">

        <PageIntro
          eyebrow="Clinician workspace"
          title="Retinal review queue"
          description="View only the patients who have granted you access, review their screenings, and share clinical guidance."
        />


        {/* Doctor statistics */}
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
                      setSelectedId(patient.id);
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
                        {patient.id}

                        {patient.latest_scan_at
                          ? ` · ${patient.latest_scan_at}`
                          : " · No screening yet"}
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

            <section className="review-panel panel">

              <div className="review-title">

                <div>
                  <span>
                    Current review
                  </span>

                  <h2>
                    {selected.name}
                  </h2>

                  <p>
                    {selected.id}
                    {selected.latest_scan_at
                      ? " · Latest scan"
                      : " · No screening yet"}
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


              {/* Screening exists */}
              {hasScreening ? (

                <>
                  <div className="scan-detail">

                    {selected.latest_image_url ? (

                      <img
                        className="fundus-placeholder"
                        src={selected.latest_image_url}
                        alt={`Latest retinal image for ${selected.name}`}
                      />

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
                        Screening result
                      </span>

                      <h3>
                        {selected.latest_label ??
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
                        {selected.latest_explanation ??
                          "The model explanation for this scan will appear here once it is returned by the analysis service."}
                      </p>

                    </div>

                  </div>


                  {/* Doctor note */}
                  <div className="note-editor">

                    <div>
                      <FileText />

                      <span>
                        Doctor’s note
                      </span>
                    </div>


                    <textarea
                      value={note}
                      onChange={(e) => {
                        setNote(e.target.value);
                        setSaved(false);
                      }}
                    />


                    <Input
                      value={followUp}
                      onChange={(e) => {
                        setFollowUp(e.target.value);
                        setSaved(false);
                      }}
                    />


                    {error && (
                      <p
                        className="form-error"
                        role="alert"
                      >
                        {error}
                      </p>
                    )}


                    <Button
                      onClick={share}
                    >
                      {saved
                        ? "Note shared"
                        : "Save & share with patient"}
                    </Button>

                  </div>
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

        {/* Doctor appointments */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <span>Appointments</span>
              <h2>Patient appointment requests</h2>
            </div>
            <CalendarDays />
          </div>

          {appointments.length === 0 ? (
            <p>No appointment requests yet.</p>
          ) : (
            appointments.map((appointment) => (
              <div key={appointment.id} className="patient-row">
                <div>
                  <strong>{appointment.date} at {appointment.time}</strong>
                  <p>Reason: {appointment.reason || "Not provided"}</p>
                  <small>Status: {appointment.status}</small>
                </div>
                {appointment.status === "requested" && (
                  <div>
                    <Button
                      onClick={() =>
                        handleAppointmentStatus(appointment.id, "confirmed")
                      }
                    >
                      Accept
                    </Button>

                    <Button
                      onClick={() =>
                        handleAppointmentStatus(appointment.id, "declined")
                      }
                    >
                      Decline
                    </Button>

                    <Button onClick={() => setReschedulingId(appointment.id)}
                    >
                      Reschedule
                    </Button>

                    {reschedulingId === appointment.id && (
                      <div>
                        <input
                          type="date"
                          id={`date-${appointment.id}`}
                          defaultValue={appointment.date}
                        />

                        <input
                          type="time"
                          id={`time-${appointment.id}`}
                          defaultValue={appointment.time}
                        />

                        <Button
                          onClick={() => {
                            const dateInput = document.getElementById(
                              `date-${appointment.id}`
                            ) as HTMLInputElement | null;

                            const timeInput = document.getElementById(
                              `time-${appointment.id}`
                            ) as HTMLInputElement | null;

                            if (!dateInput?.value || !timeInput?.value) {
                              alert("Please select a date and time.");
                              return;
                            }

                            void handleReschedule(
                              appointment.id,
                              dateInput.value,
                              timeInput.value
                            );
                            setReschedulingId(null);
                          }}
                        >
                          Save changes
                        </Button>

                        <Button onClick={() => setReschedulingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          </section>
        <p className="privacy-line">
          Patient access is consent-based. Records
          disappear from this workspace when consent
          is revoked.
        </p>

      </main>
    </AppShell>
  );
}
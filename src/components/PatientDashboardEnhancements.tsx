import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { listAppointments } from "../api/records";
import { Link } from "../router";
import type { Appointment, User } from "../api/types";

export function PatientGreeting() {
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<User>("/api/auth/me")
      .then((user) => {
        if (!active) return;
        const name = (user.full_name || "").trim().split(/\s+/)[0] || "";
        setFirstName(name);
      })
      .catch(() => {
        if (active) setFirstName("");
      });
    return () => { active = false; };
  }, []);

  const hour = new Date().getHours();
  const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Good ${period}, ${firstName || "Patient"}`;
}

function readableStatus(status: Appointment["status"]) {
  switch (status) {
    case "requested": return "Pending confirmation";
    case "confirmed": return "Confirmed";
    case "declined": return "Declined";
    case "cancelled": return "Cancelled";
    default: return "Status unavailable";
  }
}

function formatAppointment(appointment: Appointment) {
  const day = new Date(`${appointment.date}T12:00:00`);
  const valid = !Number.isNaN(day.getTime());
  const formattedDay = valid
    ? day.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : appointment.date;
  return `${formattedDay} at ${appointment.time}`;
}

/** Patient-only list is enforced by /api/appointments on Flask. */
export function AppointmentStatusOverview() {
  const [showAllAppointments, setShowAllAppointments] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listAppointments()
      .then((rows) => {
        if (active) {
          setAppointments(rows);
          setError("");
        }
      })
      .catch(() => {
        if (active) setError("We could not load appointments. Check the Flask server and try refreshing.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const ordered = [...appointments].sort((a, b) =>
    (b.created_at || "").localeCompare(a.created_at || "")
  );
  // Show the next upcoming requested/confirmed appointment first.
  const today = new Date();
  const localDay = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
  const future = appointments
    .filter((entry) => (entry.status === "requested" || entry.status === "confirmed") && entry.date >= localDay)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const featured = future[0] ?? ordered[0];
  const recent: Appointment[] = showAllAppointments ? ordered : featured ? [featured] : [];
  const pending = appointments.filter((item) => item.status === "requested").length;

  return (
    <section className="panel" style={{ marginTop: 30, marginBottom: 22 }} aria-label="Appointment status summary">
      <div className="panel-head">
        <div>
          <span>YOUR APPOINTMENTS</span>
          <h2>Appointment updates{!loading && !error ? ` (${pending} pending)` : ""}</h2>
        </div>
        <Link to="/book" className="btn btn-outline">Request appointment</Link>
      </div>

      {loading && <p style={{ marginTop: 16 }} role="status">Loading your appointments...</p>}
      {!loading && error && <p className="form-error" role="alert">{error}</p>}
      {!loading && !error && appointments.length === 0 && (
        <p style={{ marginTop: 16, color: "var(--muted-foreground)" }}>
          You have not requested an appointment yet.
        </p>
      )}
      {!loading && !error && recent.length > 0 && (
        <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
          {recent.map((appointment) => (
            <article key={appointment.id} style={{
              display: "flex", flexWrap: "wrap", justifyContent: "space-between",
              alignItems: "start", gap: 16, border: "1px solid var(--border)",
              padding: 16, borderRadius: 8, background: "var(--card)"
            }}>
              <div style={{ display: "grid", gap: 5 }}>
                <strong>{appointment.doctor_name || "Registered doctor"}</strong>
                <span>{formatAppointment(appointment)}</span>
                {appointment.reason && <small>{appointment.reason}</small>}
              </div>
              <span className="grade" aria-label={`Appointment status: ${readableStatus(appointment.status)}`}>
                {readableStatus(appointment.status)}
              </span>
            </article>
          ))}
        </div>
      )}
      {!loading && !error && appointments.length > 1 && (
        <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 12 }}
          onClick={() => setShowAllAppointments((value) => !value)}>
          {showAllAppointments ? "Show next appointment" : `View appointment history (${appointments.length})`}
        </button>
      )}
    </section>
  );
}

import { apiRequest } from "./client";
import type {
  Appointment,
  AppointmentRequest,
  ConsentRecord,
  Doctor,
  DoctorNote,
  DoctorStats,
  Patient,
  Scan
} from "./types";

// ---------- Doctors & appointments ----------
export const listDoctors = () =>
  apiRequest<Doctor[]>("/api/doctors");

export const listAppointments = () =>
  apiRequest<Appointment[]>("/api/appointments");

export type PatientNotification = {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  title: string;
  message: string;
  is_read: number;
  created_at: string;
};

export const listMyNotifications = () =>
  apiRequest<PatientNotification[]>("/api/notifications");

export const requestAppointment = (payload: AppointmentRequest) =>
  apiRequest<Appointment>("/api/appointments", {
    method: "POST",
    body: payload
  });

export const markNotificationAsRead = (notificationId: string) =>
  apiRequest<{ message: string }>(
    `/api/notifications/${encodeURIComponent(notificationId)}/read`,
    {
      method: "PATCH",
    }
  );


// Doctor-only: accept or decline an assigned appointment.
export const updateAppointmentStatus = (
  appointmentId: string,
  status: "confirmed" | "declined"
) =>
  apiRequest<Appointment>(
    `/api/appointments/${encodeURIComponent(appointmentId)}/status`,
    {
      method: "PATCH",
      body: { status }
    }
  );

// ---------- Patient history ----------
export const listMyScans = () =>
  apiRequest<Scan[]>("/api/patients/me/scans");

export const listPatientResearchScans = (patientId: string) =>
  apiRequest<Scan[]>(`/api/doctor/patients/${encodeURIComponent(patientId)}/scans`);

export const listMyNotes = () =>
  apiRequest<DoctorNote[]>("/api/patients/me/notes");

// ---------- Consent ----------
export const listConsents = () =>
  apiRequest<ConsentRecord[]>("/api/patients/me/consents");

export const setConsent = (
  doctorId: string,
  status: "active" | "revoked"
) =>
  apiRequest<ConsentRecord>(
    `/api/patients/me/consents/${encodeURIComponent(doctorId)}`,
    {
      method: "PUT",
      body: { status }
    }
  );

// ---------- Clinician ----------
export const getDoctorStats = () =>
  apiRequest<DoctorStats>("/api/doctor/stats");

export const listSharedPatients = (query = "") =>
  apiRequest<Patient[]>(
    `/api/doctor/patients${query ? `?q=${encodeURIComponent(query)}` : ""}`
  );

export const getPatient = (patientId: string) =>
  apiRequest<Patient>(
    `/api/patients/${encodeURIComponent(patientId)}`
  );

export const saveDoctorNote = (
  patientId: string,
  note: string,
  followUp: string,
  scanId?: string
) =>
  apiRequest<DoctorNote>(
    `/api/patients/${encodeURIComponent(patientId)}/notes`,
    {
      method: "POST",
      body: {
        note,
        follow_up: followUp,
        scan_id: scanId
      }
    }
  );

// Patient-only: remove a doctor note from the patient portal (original is retained).
export const removeNoteFromPatientView = (noteId: string) =>
  apiRequest<{ ok: boolean; removed_from_view: boolean }>(
    `/api/patients/me/notes/${encodeURIComponent(noteId)}`,
    { method: "DELETE" }
  );

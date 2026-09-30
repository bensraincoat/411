import { apiRequest } from "./client";
import type { Appointment, AppointmentRequest, ConsentRecord, Doctor, DoctorNote, DoctorStats, Patient, Scan } from "./types";

// ---------- Doctors & appointments ----------
/** GET /doctors → Doctor[] */
export const listDoctors = () => apiRequest<Doctor[]>("/doctors");
/** GET /appointments (current user) → Appointment[] */
export const listAppointments = () => apiRequest<Appointment[]>("/appointments");
/** POST /appointments  AppointmentRequest → Appointment */
export const requestAppointment = (payload: AppointmentRequest) =>
  apiRequest<Appointment>("/appointments", { method: "POST", body: payload });

// ---------- Patient history ----------
/** GET /patients/me/scans → Scan[] */
export const listMyScans = () => apiRequest<Scan[]>("/patients/me/scans");
/** GET /patients/me/notes → DoctorNote[] */
export const listMyNotes = () => apiRequest<DoctorNote[]>("/patients/me/notes");

// ---------- Consent ----------
/** GET /patients/me/consents → ConsentRecord[] */
export const listConsents = () => apiRequest<ConsentRecord[]>("/patients/me/consents");
/** PUT /patients/me/consents/:doctorId  { status } */
export const setConsent = (doctorId: string, status: "active" | "revoked") =>
  apiRequest<ConsentRecord>(`/patients/me/consents/${encodeURIComponent(doctorId)}`, { method: "PUT", body: { status } });

// ---------- Clinician ----------
/** GET /doctor/stats → DoctorStats */
export const getDoctorStats = () => apiRequest<DoctorStats>("/doctor/stats");
/** GET /doctor/patients?q= → Patient[] (only consenting patients) */
export const listSharedPatients = (query = "") =>
  apiRequest<Patient[]>(`/doctor/patients${query ? `?q=${encodeURIComponent(query)}` : ""}`);
/** GET /patients/:id → Patient (patient lookup) */
export const getPatient = (patientId: string) => apiRequest<Patient>(`/patients/${encodeURIComponent(patientId)}`);
/** POST /patients/:id/notes  { note, follow_up, scan_id? } → DoctorNote */
export const saveDoctorNote = (patientId: string, note: string, followUp: string, scanId?: string) =>
  apiRequest<DoctorNote>(`/patients/${encodeURIComponent(patientId)}/notes`, { method: "POST", body: { note, follow_up: followUp, scan_id: scanId } });

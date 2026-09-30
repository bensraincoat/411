/** Shapes the frontend expects from the Flask API. Adjust to match your endpoints. */
export type Role = "patient" | "doctor";
export type Grade = 0 | 1 | 2 | 3 | 4;

export interface User { id: string; email: string; full_name?: string; role: Role }
export interface AuthResponse { token: string; user: User }

export interface RegisterPayload {
  email: string; password: string; role: Role; full_name: string;
  phone?: string; address?: string;
  height_cm?: number; weight_kg?: number; conditions?: string[];
  clinic?: string; license_number?: string;
}

/** Response of POST /predict */
export interface Prediction {
  grade: Grade;
  label: string;
  confidence: number; // 0-100 or 0-1; normalised in the UI
  explanation?: string;
  model?: string;
  probabilities?: Record<string, number>;
  scan_id?: string;
}

/** Response of POST /compare-models */
export interface ModelComparison {
  results: Array<{ model: string; grade: Grade; label: string; confidence: number }>;
  consensus_grade?: Grade;
  consensus_label?: string;
  agreement?: number; // number of models agreeing with consensus
}

export interface Patient { id: string; name: string; initials?: string; latest_grade?: Grade; latest_label?: string; latest_scan_at?: string; latest_confidence?: number; latest_explanation?: string; latest_image_url?: string }
export interface Scan { id: string; patient_id: string; grade: Grade; label: string; confidence: number; model_name: string; image_url?: string; created_at: string; status: "pending" | "reviewed" }
export interface Doctor { id: string; name: string; specialty: string; clinic: string }
export interface Appointment { id: string; doctor_id: string; doctor_name?: string; date: string; time: string; reason?: string; status: "requested" | "confirmed" | "cancelled" }
export interface AppointmentRequest { doctor_id: string; date: string; time: string; reason?: string }
export interface DoctorNote { id: string; patient_id: string; scan_id?: string; doctor_name?: string; note: string; follow_up?: string; created_at: string }
export interface ConsentRecord { doctor_id: string; doctor_name: string; status: "active" | "revoked" | "pending" }
export interface DoctorStats { active_patients: number; awaiting_review: number; todays_visits: number }

import type { Doctor, DoctorStats, Patient } from "../api";

/**
 * Placeholder content shown until the Flask API responds (or if it is offline),
 * so every screen keeps its designed appearance. Delete once your API is live.
 */
export const PLACEHOLDER_DOCTORS: Doctor[] = [
  { id: "d-1", name: "Dr. Amina Morgan", specialty: "Retina specialist", clinic: "VisionCare Clinic" },
  { id: "d-2", name: "Dr. Daniel Lee", specialty: "Ophthalmologist", clinic: "Lakeview Eye Center" },
  { id: "d-3", name: "Dr. Priya Raman", specialty: "Retina specialist", clinic: "Northside Vision" },
];

export const PLACEHOLDER_PATIENTS: Patient[] = [
  { id: "P-10432", name: "Jordan Miles", initials: "JM", latest_grade: 2, latest_label: "Moderate DR", latest_scan_at: "Today, 8:42 AM" },
  { id: "P-10391", name: "Avery Lewis", initials: "AL", latest_grade: 1, latest_label: "Mild DR", latest_scan_at: "Yesterday" },
  { id: "P-10284", name: "Riley Singh", initials: "RS", latest_grade: 0, latest_label: "No DR detected", latest_scan_at: "Sep 28" },
];

export const PLACEHOLDER_STATS: DoctorStats = { active_patients: 12, awaiting_review: 3, todays_visits: 4 };

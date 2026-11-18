import sqlite3
import uuid
from datetime import datetime

DB_NAME = "appointments.db"


def get_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def init_appointments_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS appointments (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            doctor_id TEXT NOT NULL,
            doctor_name TEXT,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            reason TEXT,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            appointment_id TEXT,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
            )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reschedule_proposals (
            id TEXT PRIMARY KEY,
            appointment_id TEXT NOT NULL,
            proposed_date TEXT NOT NULL,
            proposed_time TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

def create_notification(patient_id, appointment_id, title, message):
    notification_id = str(uuid.uuid4())

    conn = get_connection()

    try:
        conn.execute("""
            INSERT INTO notifications (
                id,
                patient_id,
                appointment_id,
                title,
                message,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            notification_id,
            patient_id,
            appointment_id,
            title,
            message,
            datetime.now().isoformat()
        ))

        conn.commit()
    finally:
        conn.close()

    return notification_id



def create_appointment(
    patient_id,
    doctor_id,
    doctor_name,
    date,
    time,
    reason=""
):
    appointment_id = str(uuid.uuid4())

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO appointments (
            id,
            patient_id,
            doctor_id,
            doctor_name,
            date,
            time,
            reason,
            status,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        appointment_id,
        patient_id,
        doctor_id,
        doctor_name,
        date,
        time,
        reason,
        "requested",
        datetime.now().isoformat(),
    ))

    conn.commit()
    conn.close()

    return get_appointment_by_id(appointment_id)


def get_appointment_by_id(appointment_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *
        FROM appointments
        WHERE id = ?
    """, (appointment_id,))

    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def get_appointments_for_user(user_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *
        FROM appointments
        WHERE patient_id = ?
        ORDER BY date ASC, time ASC
    """, (user_id,))

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


# Doctor-only list; caller must derive doctor_id from the authenticated user.
def get_appointments_for_doctor(doctor_id):
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT * FROM appointments
            WHERE doctor_id = ?
            ORDER BY date ASC, time ASC
            """,
            (doctor_id,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def update_appointment_status(appointment_id, doctor_id, new_status):
    """Change a pending appointment belonging to this doctor only.

    Returns None if the request is missing, already processed, or the chosen
    slot already has a confirmed appointment for the same doctor.
    """
    if new_status not in {"confirmed", "declined"}:
        raise ValueError("Invalid appointment status")

    conn = get_connection()
    try:
        # Serialize changes so two confirmations cannot claim the same slot.
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            """
            SELECT * FROM appointments
            WHERE id = ? AND doctor_id = ? AND status = 'requested'
            """,
            (appointment_id, doctor_id),
        ).fetchone()
        if row is None:
            conn.rollback()
            return None

        if new_status == "confirmed":
            clash = conn.execute(
                """
                SELECT 1 FROM appointments
                WHERE doctor_id = ? AND date = ? AND time = ?
                  AND status = 'confirmed' AND id != ?
                LIMIT 1
                """,
                (doctor_id, row["date"], row["time"], appointment_id),
            ).fetchone()
            if clash is not None:
                conn.rollback()
                return None

        cursor = conn.execute(
            """
            UPDATE appointments SET status = ?
            WHERE id = ? AND doctor_id = ? AND status = 'requested'
            """,
            (new_status, appointment_id, doctor_id),
        )
        if cursor.rowcount != 1:
            conn.rollback()
            return None
        conn.commit()
    finally:
        conn.close()

    return get_appointment_by_id(appointment_id)




def get_notifications_for_patient(patient_id):
    conn = get_connection()

    try:
        rows = conn.execute(
            """
            SELECT *
            FROM notifications
            WHERE patient_id = ?
            ORDER BY created_at DESC
            """,
            (patient_id,),
        ).fetchall()
        return [dict(row) for row in rows]

    finally:
        conn.close()


def mark_notification_as_read(notification_id, patient_id):
    conn = get_connection()

    try:
        cursor = conn.execute(
            """
            UPDATE notifications
            SET is_read = 1
            WHERE id = ? AND patient_id = ?
            """,
            (notification_id, patient_id),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def create_reschedule_proposal(appointment_id, doctor_id, new_date, new_time):
    conn = get_connection()

    try:
        appointment = conn.execute("""
            SELECT * FROM appointments
            WHERE id = ? AND doctor_id = ?
        """, (appointment_id, doctor_id)).fetchone()

        if appointment is None:
            return None

        if appointment["status"] not in ("requested", "confirmed"):
            return None

        existing = conn.execute("""
            SELECT id FROM reschedule_proposals
            WHERE appointment_id = ? AND status = 'pending'
        """, (appointment_id,)).fetchone()

        if existing is not None:
            return None

        proposal_id = str(uuid.uuid4())

        conn.execute("""
            INSERT INTO reschedule_proposals (
                id, appointment_id, proposed_date,
                proposed_time, status, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            proposal_id,
            appointment_id,
            new_date,
            new_time,
            "pending",
            datetime.now().isoformat()
        ))

        conn.commit()

        return {
            "id": proposal_id,
            "appointment_id": appointment_id,
            "patient_id": appointment["patient_id"],
            "proposed_date": new_date,
            "proposed_time": new_time,
            "status": "pending"
        }
    finally:
        conn.close()


def get_reschedule_proposals_for_patient(patient_id):
    conn = get_connection()

    try:
        rows = conn.execute("""
            SELECT
                r.id,
                r.appointment_id,
                r.proposed_date,
                r.proposed_time,
                r.status,
                r.created_at,
                a.date AS current_date,
                a.time AS current_time,
                a.doctor_name
            FROM reschedule_proposals r
            JOIN appointments a ON r.appointment_id = a.id
            WHERE a.patient_id = ?
              AND r.status = 'pending'
              AND a.status IN ('requested', 'confirmed')
            ORDER BY r.created_at DESC
        """, (patient_id,)).fetchall()

        return [dict(row) for row in rows]
    finally:
        conn.close()


def respond_to_reschedule_proposal(proposal_id, patient_id, accept):
    conn = get_connection()

    try:
        conn.execute("BEGIN IMMEDIATE")

        proposal = conn.execute("""
            SELECT r.*, a.patient_id, a.status AS appointment_status
            FROM reschedule_proposals r
            JOIN appointments a ON r.appointment_id = a.id
            WHERE r.id = ? AND a.patient_id = ?
              AND r.status = 'pending'
        """, (proposal_id, patient_id)).fetchone()

        if proposal is None or proposal["appointment_status"] not in (
            "requested", "confirmed"
        ):
            conn.rollback()
            return None

        if accept:
            conflict = conn.execute("""
                SELECT id FROM appointments
                WHERE doctor_id = (
                    SELECT doctor_id FROM appointments WHERE id = ?
                )
                AND date = ? AND time = ?
                AND status = 'confirmed'
                AND id != ?
            """, (
                proposal["appointment_id"],
                proposal["proposed_date"],
                proposal["proposed_time"],
                proposal["appointment_id"]
            )).fetchone()

            if conflict is not None:
                conn.rollback()
                return None

            conn.execute("""
                UPDATE appointments
                SET date = ?, time = ?, status = 'confirmed'
                WHERE id = ?
            """, (
                proposal["proposed_date"],
                proposal["proposed_time"],
                proposal["appointment_id"]
            ))

        new_status = "accepted" if accept else "declined"

        conn.execute("""
            UPDATE reschedule_proposals
            SET status = ?
            WHERE id = ?
        """, (new_status, proposal_id))

        conn.commit()

        return {
            "id": proposal_id,
            "appointment_id": proposal["appointment_id"],
            "status": new_status,
            "proposed_date": proposal["proposed_date"],
            "proposed_time": proposal["proposed_time"]
        }

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()



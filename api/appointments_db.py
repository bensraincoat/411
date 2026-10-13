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

    conn.commit()
    conn.close()


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
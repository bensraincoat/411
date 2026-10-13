import sqlite3
import uuid
from datetime import datetime

DB_NAME = "doctor_notes.db"


def get_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def init_doctor_notes_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS doctor_notes (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            doctor_id TEXT NOT NULL,
            doctor_name TEXT NOT NULL,
            scan_id TEXT,
            note TEXT NOT NULL,
            follow_up TEXT,
            created_at TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()


def add_doctor_note(
    patient_id,
    doctor_id,
    doctor_name,
    note,
    follow_up="",
    scan_id=None
):
    note_id = str(uuid.uuid4())

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO doctor_notes (
            id,
            patient_id,
            doctor_id,
            doctor_name,
            scan_id,
            note,
            follow_up,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        note_id,
        patient_id,
        doctor_id,
        doctor_name,
        scan_id,
        note,
        follow_up,
        datetime.now().isoformat(),
    ))

    conn.commit()
    conn.close()

    return get_doctor_note_by_id(note_id)


def get_doctor_note_by_id(note_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *
        FROM doctor_notes
        WHERE id = ?
    """, (note_id,))

    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def get_notes_for_patient(patient_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *
        FROM doctor_notes
        WHERE patient_id = ?
        ORDER BY created_at DESC
    """, (patient_id,))

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]
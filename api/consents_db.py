import sqlite3
from datetime import datetime

DB_NAME = "consents.db"


def get_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def init_consents_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS consents (
            patient_id TEXT NOT NULL,
            doctor_id TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (patient_id, doctor_id)
        )
    """)

    conn.commit()
    conn.close()


def set_patient_doctor_consent(patient_id, doctor_id, status):
    conn = get_connection()
    cursor = conn.cursor()

    now = datetime.now().isoformat()

    # Only one doctor can be active for a patient at a time.
    if status == "active":
        cursor.execute("""
            UPDATE consents
            SET status = 'revoked',
                updated_at = ?
            WHERE patient_id = ?
              AND status = 'active'
        """, (
            now,
            patient_id,
        ))

    cursor.execute("""
        INSERT INTO consents (
            patient_id,
            doctor_id,
            status,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?)

        ON CONFLICT(patient_id, doctor_id)
        DO UPDATE SET
            status = excluded.status,
            updated_at = excluded.updated_at
    """, (
        patient_id,
        doctor_id,
        status,
        now,
        now,
    ))

    conn.commit()
    conn.close()


def get_consents_for_patient(patient_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *
        FROM consents
        WHERE patient_id = ?
        ORDER BY updated_at DESC
    """, (patient_id,))

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def get_active_consent_for_patient(patient_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *
        FROM consents
        WHERE patient_id = ?
          AND status = 'active'
        LIMIT 1
    """, (patient_id,))

    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def get_active_patients_for_doctor(doctor_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT patient_id
        FROM consents
        WHERE doctor_id = ?
          AND status = 'active'
    """, (doctor_id,))

    rows = cursor.fetchall()
    conn.close()

    return [
        row["patient_id"]
        for row in rows
    ]
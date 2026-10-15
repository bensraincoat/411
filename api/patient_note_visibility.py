"""Patient-specific removal from view for doctor notes. Original notes are retained.

Test/demo feature: a clinical deployment needs a retention and audit policy.
"""
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "openI-local-data"
DB_PATH = DATA_DIR / "patient_note_visibility.db"


def _connect():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(DB_PATH), timeout=10)
    connection.execute("""
        CREATE TABLE IF NOT EXISTS patient_hidden_notes (
            patient_id TEXT NOT NULL,
            note_id TEXT NOT NULL,
            hidden_at TEXT NOT NULL,
            PRIMARY KEY (patient_id, note_id)
        )
    """)
    return connection


def get_hidden_note_ids(patient_id):
    with closing(_connect()) as connection:
        rows = connection.execute(
            "SELECT note_id FROM patient_hidden_notes WHERE patient_id = ?",
            (str(patient_id),)
        ).fetchall()
    return {row[0] for row in rows}


def hide_note_for_patient(patient_id, note_id):
    with closing(_connect()) as connection:
        connection.execute(
            """INSERT OR IGNORE INTO patient_hidden_notes
               (patient_id, note_id, hidden_at) VALUES (?, ?, ?)""",
            (str(patient_id), str(note_id), datetime.now(timezone.utc).isoformat())
        )
        connection.commit()

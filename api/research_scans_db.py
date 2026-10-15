"""Local, access-controlled research scan history (not clinical records)."""
from __future__ import annotations

from datetime import datetime, timezone
from contextlib import closing
from pathlib import Path
import sqlite3
from uuid import uuid4

DB_PATH = Path(__file__).resolve().parent / 'research_scans.db'


def connect():
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    return conn


def init_research_db():
    with closing(connect()) as conn, conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS research_scans (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                image_bytes BLOB NOT NULL,
                image_mime TEXT NOT NULL,
                grade INTEGER NOT NULL CHECK (grade BETWEEN 0 AND 4),
                label TEXT NOT NULL,
                confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
                model_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                research_only INTEGER NOT NULL DEFAULT 1
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_research_patient ON research_scans(patient_id, created_at DESC)")


PUBLIC_COLUMNS = "id, patient_id, filename, grade, label, confidence, model_name, created_at, research_only"


def _public(row):
    if row is None:
        return None
    d = dict(row)
    d['research_only'] = bool(d['research_only'])
    d['status'] = 'pending'  # Unreviewed research output, never a diagnosis.
    d['scan_id'] = d['id']
    return d


def save_scans(patient_id, entries):
    """Save a fully inferred batch atomically; input is (filename, bytes, MIME, prediction)."""
    now = datetime.now(timezone.utc).isoformat()
    saved = []
    with closing(connect()) as conn, conn:
        for filename, raw, mime, pred in entries:
            scan_id = str(uuid4())
            grade = int(pred['grade'])
            confidence = float(pred['confidence'])
            if not (0 <= grade <= 4 and 0 <= confidence <= 1):
                raise ValueError('Invalid model result')
            conn.execute("""
                INSERT INTO research_scans
                (id,patient_id,filename,image_bytes,image_mime,grade,label,confidence,model_name,created_at,research_only)
                VALUES (?,?,?,?,?,?,?,?,?,?,1)
            """, (scan_id, patient_id, filename, raw, mime, grade,
                  str(pred['label']), confidence, str(pred.get('model') or 'YOLO26 Nano'), now))
            saved.append(scan_id)
    return saved


def list_scans(patient_id):
    with closing(connect()) as conn, conn:
        rows = conn.execute(f"SELECT {PUBLIC_COLUMNS} FROM research_scans WHERE patient_id=? ORDER BY created_at DESC, rowid DESC", (patient_id,)).fetchall()
    return [_public(row) for row in rows]


def latest_scan(patient_id):
    with closing(connect()) as conn, conn:
        row = conn.execute(f"SELECT {PUBLIC_COLUMNS} FROM research_scans WHERE patient_id=? ORDER BY created_at DESC, rowid DESC LIMIT 1", (patient_id,)).fetchone()
    return _public(row)


def find_scan(scan_id):
    """Metadata lookup used for authenticated, on-demand research explanations."""
    with closing(connect()) as conn, conn:
        row = conn.execute(
            f"SELECT {PUBLIC_COLUMNS} FROM research_scans WHERE id=?", (scan_id,)
        ).fetchone()
    return _public(row)


def find_image(scan_id):
    with closing(connect()) as conn, conn:
        row = conn.execute("SELECT patient_id, image_bytes, image_mime FROM research_scans WHERE id=?", (scan_id,)).fetchone()
    return dict(row) if row else None

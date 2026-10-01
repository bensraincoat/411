import sqlite3
import json
import uuid
import secrets
from datetime import datetime

DB_NAME = "users.db"


def get_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def init_users_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            full_name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            height_cm REAL,
            weight_kg REAL,
            conditions TEXT,
            clinic TEXT,
            license_number TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(email, role)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS auth_tokens (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    conn.commit()
    conn.close()


def create_user(
    email,
    password_hash,
    role,
    full_name,
    phone=None,
    address=None,
    height_cm=None,
    weight_kg=None,
    conditions=None,
    clinic=None,
    license_number=None,
):
    user_id = str(uuid.uuid4())

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO users (
                id,
                email,
                password_hash,
                role,
                full_name,
                phone,
                address,
                height_cm,
                weight_kg,
                conditions,
                clinic,
                license_number,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            email.lower(),
            password_hash,
            role,
            full_name,
            phone,
            address,
            height_cm,
            weight_kg,
            json.dumps(conditions or []),
            clinic,
            license_number,
            datetime.now().isoformat(),
        ))

        conn.commit()

    except sqlite3.IntegrityError:
        conn.close()
        return None

    conn.close()

    return get_user_by_id(user_id)


def get_user_by_id(user_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *
        FROM users
        WHERE id = ?
    """, (user_id,))

    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def get_user_by_email_role(email, role):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *
        FROM users
        WHERE email = ? AND role = ?
    """, (email.lower(), role))

    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def create_auth_token(user_id):
    token = secrets.token_urlsafe(32)

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO auth_tokens (
            token,
            user_id,
            created_at
        )
        VALUES (?, ?, ?)
    """, (
        token,
        user_id,
        datetime.now().isoformat(),
    ))

    conn.commit()
    conn.close()

    return token


def get_user_by_token(token):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT users.*
        FROM auth_tokens
        JOIN users
            ON auth_tokens.user_id = users.id
        WHERE auth_tokens.token = ?
    """, (token,))

    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def delete_auth_token(token):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM auth_tokens
        WHERE token = ?
    """, (token,))

    conn.commit()
    conn.close()
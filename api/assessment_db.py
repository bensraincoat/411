import sqlite3
from datetime import datetime

Database_NAME = "assessments.db"

def init_db():
    #connection to the database
    conn = sqlite3.connect(Database_NAME)
    #used to give instructions to the database
    cursor = conn.cursor()

    #Create a table for assessments if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            date_created TEXT NOT NULL,
            status TEXT NOT NULL,
            grade INTEGER,
            label TEXT,
            confidence REAL,
            message TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS patients (
            patient_id TEXT PRIMARY KEY,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            date_of_birth TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()


    
def add_assessment(patient_id, filename, status):
    conn = sqlite3.connect(Database_NAME)
    cursor = conn.cursor()

    # Insert a new assessment into the database
    
    date_created = datetime.now()
    date_created = date_created.isoformat()  # get the current date and time in ISO format
    cursor.execute('''INSERT INTO assessments (patient_id, filename, date_created, status)
                        VALUES (?, ?, ?, ?)''',
                        
    (patient_id, filename, date_created, status)
    )

        
    assessment_id = cursor.lastrowid  # Gets the ID that was just inserted
    conn.commit()
    conn.close()
    return assessment_id
def get_assessments():
    conn = sqlite3.connect(Database_NAME)
    conn.row_factory = sqlite3.Row  # allows us to access columns by name
    cursor = conn.cursor()

    # retrievs all assessments from the database
    cursor.execute('SELECT * FROM assessments ORDER BY id DESC')
    assessments = cursor.fetchall()

    conn.close()
    return [dict(assessment) for assessment in assessments]  # convert sqlite3.Row to dict

def update_assessment(assessment_id, grade, label, confidence, message, status):
    conn = sqlite3.connect(Database_NAME)
    cursor = conn.cursor()

    # Update the assessment with the given ID
    cursor.execute('''
        UPDATE assessments
        SET grade = ?, label = ?, confidence = ?, message = ?, status = ?
        WHERE id = ?
    ''', (grade, label, confidence, message, status, assessment_id))

    conn.commit()
    conn.close()

def add_patient(patient_id, first_name, last_name, date_of_birth):
    conn = sqlite3.connect(Database_NAME)
    cursor = conn.cursor()

    # Insert a new patient into the database
    cursor.execute('''
        INSERT INTO patients (patient_id, first_name, last_name, date_of_birth)
        VALUES (?, ?, ?, ?)
    ''', (patient_id, first_name, last_name, date_of_birth))

    conn.commit()
    conn.close()
def get_patient(patient_id):
    conn = sqlite3.connect(Database_NAME)
    conn.row_factory = sqlite3.Row  # allows us to access columns by name
    cursor = conn.cursor()

    # Retrieve the patient with the given ID
    cursor.execute('SELECT * FROM patients WHERE patient_id = ?', (patient_id,))
    patient = cursor.fetchone()

    conn.close()
    return dict(patient) if patient else None  # convert sqlite3.Row to dict if found, else return None
if __name__ == "__main__":
        init_db()
        print(get_patient("TEST600"))
        #add_patient("TEST600", "John", "Doe", "2026-06-07")
        #add_assessment("67890", "assessment1.jpg", "pending")
        #print(get_assessments())
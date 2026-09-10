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

if __name__ == "__main__":
        init_db()
        #add_assessment("67890", "assessment1.jpg", "pending")
        #print(get_assessments())
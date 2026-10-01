import time

from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

from assessment_db import (
    init_db,
    add_assessment,
    update_assessment,
    get_assessments,
    get_assessments_for_patient,
    get_latest_assessment_for_patient,
)

from users_db import (
    init_users_db,
    create_user,
    get_user_by_email_role,
    get_user_by_id,
    get_all_patients,
    get_all_doctors,
    create_auth_token,
    get_user_by_token,
    delete_auth_token,
)

from appointments_db import (
    init_appointments_db,
    create_appointment,
    get_appointments_for_user,
)

from doctor_notes_db import (
    init_doctor_notes_db,
    add_doctor_note,
    get_notes_for_patient,
)

from consents_db import (
    init_consents_db,
    set_patient_doctor_consent,
    get_consents_for_patient,
    get_active_patients_for_doctor,
)


app = Flask(__name__)


# -------------------------------------------------
# Initialize databases
# -------------------------------------------------

init_db()
init_users_db()
init_appointments_db()
init_doctor_notes_db()
init_consents_db()


# -------------------------------------------------
# Diabetic retinopathy grade information
# -------------------------------------------------

GRADE_INFO = {
    0: {
        "label": "No Diabetic Retinopathy",
        "message": (
            "Your eye examination shows no signs of diabetic retinopathy at this time. "
            "It's important to continue managing your diabetes well and have regular "
            "eye check-ups to monitor your condition."
        ),
    },
    1: {
        "label": "Mild NPDR",
        "message": (
            "You have been diagnosed with mild non-proliferative diabetic retinopathy. "
            "Small areas of swelling exist in the blood vessels of your retina. "
            "Maintain good blood sugar control and schedule regular follow-ups."
        ),
    },
    2: {
        "label": "Moderate NPDR",
        "message": (
            "You have moderate non-proliferative diabetic retinopathy. "
            "Blood vessels in the retina are beginning to be blocked. "
            "Consult your ophthalmologist for a treatment plan."
        ),
    },
    3: {
        "label": "Severe NPDR",
        "message": (
            "You have severe non-proliferative diabetic retinopathy. "
            "Many blood vessels are blocked, depriving areas of the retina of blood supply. "
            "Prompt medical attention is recommended."
        ),
    },
    4: {
        "label": "Proliferative DR",
        "message": (
            "You have been diagnosed with proliferative diabetic retinopathy, "
            "the advanced stage of the disease. New blood vessels are growing in your retina, "
            "which can lead to serious vision problems. Treatment such as laser therapy "
            "or surgery may be necessary to preserve your vision."
        ),
    },
}


# -------------------------------------------------
# Helper functions
# -------------------------------------------------

def public_user(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role": user["role"],
    }


def get_bearer_token():
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return None

    return auth_header[7:].strip()


def authenticated_user():
    token = get_bearer_token()

    if not token:
        return None

    return get_user_by_token(token)


def patient_summary(patient):
    latest = get_latest_assessment_for_patient(patient["id"])

    initials = "".join(
        word[0].upper()
        for word in patient["full_name"].split()
        if word
    )[:2]

    result = {
        "id": patient["id"],
        "name": patient["full_name"],
        "initials": initials,
    }

    if latest:
        result.update({
            "latest_grade": latest["grade"],
            "latest_label": latest["label"],
            "latest_scan_at": latest["date_created"],
            "latest_confidence": latest["confidence"],
            "latest_explanation": latest["message"],
        })

    return result


# -------------------------------------------------
# Authentication routes
# -------------------------------------------------

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    role = str(data.get("role", "")).strip().lower()
    full_name = str(data.get("full_name", "")).strip()

    if not email or not password or not full_name:
        return jsonify({
            "error": "Full name, email, and password are required"
        }), 400

    if role not in {"patient", "doctor"}:
        return jsonify({
            "error": "Role must be patient or doctor"
        }), 400

    if len(password) < 8:
        return jsonify({
            "error": "Password must be at least 8 characters"
        }), 400

    if role == "doctor" and not str(
        data.get("license_number", "")
    ).strip():
        return jsonify({
            "error": "License number is required for ophthalmologists"
        }), 400

    password_hash = generate_password_hash(password)

    user = create_user(
        email=email,
        password_hash=password_hash,
        role=role,
        full_name=full_name,
        phone=data.get("phone"),
        address=data.get("address"),
        height_cm=data.get("height_cm"),
        weight_kg=data.get("weight_kg"),
        conditions=data.get("conditions", []),
        clinic=data.get("clinic"),
        license_number=data.get("license_number"),
    )

    if user is None:
        return jsonify({
            "error": "An account with this email and role already exists"
        }), 409

    token = create_auth_token(user["id"])

    return jsonify({
        "token": token,
        "user": public_user(user),
    }), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    role = str(data.get("role", "")).strip().lower()

    if not email or not password or not role:
        return jsonify({
            "error": "Email, password, and role are required"
        }), 400

    user = get_user_by_email_role(email, role)

    if user is None:
        return jsonify({
            "error": "Invalid email, password, or account type"
        }), 401

    if not check_password_hash(
        user["password_hash"],
        password
    ):
        return jsonify({
            "error": "Invalid email, password, or account type"
        }), 401

    token = create_auth_token(user["id"])

    return jsonify({
        "token": token,
        "user": public_user(user),
    })


@app.route("/api/auth/me", methods=["GET"])
def current_user():
    user = authenticated_user()

    if user is None:
        return jsonify({
            "error": "Authentication required"
        }), 401

    return jsonify(public_user(user))


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    token = get_bearer_token()

    if token:
        delete_auth_token(token)

    return jsonify({
        "ok": True
    })


# -------------------------------------------------
# Doctors available for appointments
# -------------------------------------------------

@app.route("/api/doctors", methods=["GET"])
def doctors():
    registered_doctors = get_all_doctors()

    results = []

    for doctor in registered_doctors:
        results.append({
            "id": doctor["id"],
            "name": doctor["full_name"],
            "specialty": "Ophthalmologist",
            "clinic": doctor["clinic"] or "Clinic not provided", 
        })

    return jsonify(results)

# -------------------------------------------------
# Appointment routes
# -------------------------------------------------

@app.route("/api/appointments", methods=["POST"])
def create_appointment_route():
    user = authenticated_user()

    if user is None:
        return jsonify({
            "error": "Authentication required"
        }), 401

    if user["role"] != "patient":
        return jsonify({
            "error": "Only patients can request appointments"
        }), 403

    data = request.get_json(silent=True) or {}

    doctor_id = str(
        data.get("doctor_id", "")
    ).strip()

    date = str(
        data.get("date", "")
    ).strip()

    appointment_time = str(
        data.get("time", "")
    ).strip()

    reason = str(
        data.get("reason", "")
    ).strip()

    if not doctor_id or not date or not appointment_time:
        return jsonify({
            "error": "Doctor, date, and time are required"
        }), 400

    doctor = get_user_by_id(doctor_id)
        

    if doctor is None or doctor["role"] != "doctor":
        return jsonify({
            "error": "Selected doctor was not found"
        }), 404

    appointment = create_appointment(
        patient_id=user["id"],
        doctor_id=doctor_id,
        doctor_name=doctor["full_name"],
        date=date,
        time=appointment_time,
        reason=reason,
    )

    return jsonify(appointment), 201


@app.route("/api/appointments", methods=["GET"])
def list_appointments_route():
    user = authenticated_user()

    if user is None:
        return jsonify({
            "error": "Authentication required"
        }), 401

    appointments = get_appointments_for_user(
        user["id"]
    )

    return jsonify(appointments)


# -------------------------------------------------
# Doctor portal
# -------------------------------------------------

@app.route("/api/doctor/stats", methods=["GET"])
def doctor_stats():
    doctor = authenticated_user()

    if doctor is None:
        return jsonify({
            "error": "Authentication required"
        }), 401

    if doctor["role"] != "doctor":
        return jsonify({
            "error": "Doctor access required"
        }), 403

    patients = get_all_patients()

    awaiting_review = 0

    for patient in patients:
        latest = get_latest_assessment_for_patient(
            patient["id"]
        )

        if latest:
            notes = get_notes_for_patient(
                patient["id"]
            )

            reviewed_by_this_doctor = any(
                note["doctor_id"] == doctor["id"]
                for note in notes
            )

            if not reviewed_by_this_doctor:
                awaiting_review += 1

    return jsonify({
        "active_patients": len(patients),
        "awaiting_review": awaiting_review,

        # We can connect this to doctor-specific
        # appointments later.
        "todays_visits": 0,
    })


@app.route("/api/doctor/patients", methods=["GET"])
def doctor_patients():
    doctor = authenticated_user()

    if doctor is None:
        return jsonify({
            "error": "Authentication required"
        }), 401

    if doctor["role"] != "doctor":
        return jsonify({
            "error": "Doctor access required"
        }), 403

    query = request.args.get(
        "q",
        ""
    ).strip().lower()

    patients = get_all_patients()

    results = []

    for patient in patients:
        if query:
            search_text = (
                patient["full_name"]
                + " "
                + patient["id"]
            ).lower()

            if query not in search_text:
                continue

        results.append(
            patient_summary(patient)
        )

    return jsonify(results)


@app.route(
    "/api/patients/<patient_id>",
    methods=["GET"]
)
def get_patient_route(patient_id):
    doctor = authenticated_user()

    if doctor is None:
        return jsonify({
            "error": "Authentication required"
        }), 401

    if doctor["role"] != "doctor":
        return jsonify({
            "error": "Doctor access required"
        }), 403

    patient = get_user_by_id(patient_id)

    if (
        patient is None
        or patient["role"] != "patient"
    ):
        return jsonify({
            "error": "Patient not found"
        }), 404

    return jsonify(
        patient_summary(patient)
    )


# -------------------------------------------------
# Doctor notes
# -------------------------------------------------

@app.route(
    "/api/patients/<patient_id>/notes",
    methods=["POST"]
)
def save_doctor_note_route(patient_id):
    doctor = authenticated_user()

    if doctor is None:
        return jsonify({
            "error": "Authentication required"
        }), 401

    if doctor["role"] != "doctor":
        return jsonify({
            "error": "Doctor access required"
        }), 403

    patient = get_user_by_id(patient_id)

    if (
        patient is None
        or patient["role"] != "patient"
    ):
        return jsonify({
            "error": "Patient not found"
        }), 404

    data = request.get_json(
        silent=True
    ) or {}

    note = str(
        data.get("note", "")
    ).strip()

    follow_up = str(
        data.get("follow_up", "")
    ).strip()

    scan_id = data.get("scan_id")

    if not note:
        return jsonify({
            "error": "Doctor note is required"
        }), 400

    saved_note = add_doctor_note(
        patient_id=patient_id,
        doctor_id=doctor["id"],
        doctor_name=doctor["full_name"],
        note=note,
        follow_up=follow_up,
        scan_id=scan_id,
    )

    return jsonify(saved_note), 201


@app.route(
    "/api/patients/me/notes",
    methods=["GET"]
)
def patient_notes():
    patient = authenticated_user()

    if patient is None:
        return jsonify({
            "error": "Authentication required"
        }), 401

    if patient["role"] != "patient":
        return jsonify({
            "error": "Patient access required"
        }), 403

    notes = get_notes_for_patient(
        patient["id"]
    )

    return jsonify(notes)


# -------------------------------------------------
# General API route
# -------------------------------------------------

@app.route("/api/time")
def get_current_time():
    return {
        "time": time.time()
    }

# -------------------------------------------------
# Patient clinician consent
# -------------------------------------------------

@app.route("/api/patients/me/consents", methods=["GET"])
def list_patient_consents():
    patient = authenticated_user()

    if patient is None:
        return jsonify({
            "error": "Authentication required"
        }), 401

    if patient["role"] != "patient":
        return jsonify({
            "error": "Patient access required"
        }), 403

    consent_rows = get_consents_for_patient(
        patient["id"]
    )

    results = []

    for consent in consent_rows:
        doctor = get_user_by_id(
            consent["doctor_id"]
        )

        if doctor is None:
            continue

        results.append({
            "doctor_id": doctor["id"],
            "doctor_name": doctor["full_name"],
            "status": consent["status"],
        })

    return jsonify(results)


@app.route(
    "/api/patients/me/consents/<doctor_id>",
    methods=["PUT"]
)
def update_patient_consent(doctor_id):
    patient = authenticated_user()

    if patient is None:
        return jsonify({
            "error": "Authentication required"
        }), 401

    if patient["role"] != "patient":
        return jsonify({
            "error": "Patient access required"
        }), 403

    doctor = get_user_by_id(doctor_id)

    if doctor is None or doctor["role"] != "doctor":
        return jsonify({
            "error": "Doctor not found"
        }), 404

    data = request.get_json(silent=True) or {}

    status = str(
        data.get("status", "")
    ).strip().lower()

    if status not in {
        "active",
        "revoked",
        "pending",
    }:
        return jsonify({
            "error": "Invalid consent status"
        }), 400

    set_patient_doctor_consent(
        patient["id"],
        doctor_id,
        status,
    )

    return jsonify({
        "doctor_id": doctor["id"],
        "doctor_name": doctor["full_name"],
        "status": status,
    })

# -------------------------------------------------
# Retinal prediction
# -------------------------------------------------

@app.route(
    "/api/predict",
    methods=["POST"]
)
def predict():
    files = request.files.getlist(
        "images"
    )

    patient_id = request.form.get(
        "patient_id",
        ""
    ).strip()

    signed_in_user = authenticated_user()

    if signed_in_user and signed_in_user["role"] == "patient":
        patient_id = signed_in_user["id"]

    model = request.form.get(
        "model",
        ""
    ).strip()

    if not patient_id:
        return jsonify({
            "error": "Patient ID is required"
        }), 400

    allowed_models = {
        "DenseNet121",
        "ResNet50",
        "InceptionV3",
        "MobileNetV2",
        "Xception",
    }

    if model not in allowed_models:
        return jsonify({
            "error": "Invalid analysis model"
        }), 400

    if (
        not files
        or all(
            f.filename == ""
            for f in files
        )
    ):
        return jsonify({
            "error": "No images provided"
        }), 400

    predictions = []

    for f in files:
        assessment_id = add_assessment(
            patient_id,
            f.filename,
            "pending",
        )

        # TODO:
        # Replace with real trained AI model.
        grade = 0
        confidence = 0.94

        info = GRADE_INFO[grade]

        update_assessment(
            assessment_id,
            grade,
            info["label"],
            confidence,
            info["message"],
            "completed",
        )

        predictions.append({
            "filename": f.filename,
            "model": model,
            "grade": grade,
            "label": info["label"],
            "confidence": confidence,
            "message": info["message"],
        })

    return jsonify({
        "predictions": predictions
    })


# -------------------------------------------------
# Assessment history
# -------------------------------------------------

@app.route(
    "/api/assessments",
    methods=["GET"]
)
def assessments():
    assessment_list = get_assessments()

    return jsonify({
        "assessments": assessment_list
    })
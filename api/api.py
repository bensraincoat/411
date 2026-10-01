import time

from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

from assessment_db import (
    init_db,
    add_assessment,
    update_assessment,
    get_assessments,
)

from users_db import (
    init_users_db,
    create_user,
    get_user_by_email_role,
    create_auth_token,
    get_user_by_token,
    delete_auth_token,
)

from appointments_db import (
    init_appointments_db,
    create_appointment,
    get_appointments_for_user,
)


app = Flask(__name__)

# Make sure database tables exist when Flask starts
init_db()
init_users_db()
init_appointments_db()


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
# Authentication helper functions
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

    if role == "doctor" and not str(data.get("license_number", "")).strip():
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

    if not check_password_hash(user["password_hash"], password):
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
    token = get_bearer_token()

    if not token:
        return jsonify({
            "error": "Authentication required"
        }), 401

    user = get_user_by_token(token)

    if user is None:
        return jsonify({
            "error": "Invalid or expired login"
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
# Doctors
# -------------------------------------------------

DEMO_DOCTORS = [
    {
        "id": "doctor-1",
        "name": "Dr. Amina Morgan",
        "specialty": "Retina specialist",
        "clinic": "VisionCare Clinic",
    },
    {
        "id": "doctor-2",
        "name": "Dr. Daniel Lee",
        "specialty": "Ophthalmologist",
        "clinic": "Lakeview Eye Center",
    },
    {
        "id": "doctor-3",
        "name": "Dr. Priya Raman",
        "specialty": "Retina specialist",
        "clinic": "Northside Vision",
    },
]


@app.route("/api/doctors", methods=["GET"])
def doctors():
    return jsonify(DEMO_DOCTORS)


# -------------------------------------------------
# Appointment routes
# -------------------------------------------------

@app.route("/api/appointments", methods=["POST"])
def create_appointment_route():
    token = get_bearer_token()

    if not token:
        return jsonify({
            "error": "Authentication required"
        }), 401

    user = get_user_by_token(token)

    if user is None:
        return jsonify({
            "error": "Invalid or expired login"
        }), 401

    if user["role"] != "patient":
        return jsonify({
            "error": "Only patients can request appointments"
        }), 403

    data = request.get_json(silent=True) or {}

    doctor_id = str(data.get("doctor_id", "")).strip()
    date = str(data.get("date", "")).strip()
    appointment_time = str(data.get("time", "")).strip()
    reason = str(data.get("reason", "")).strip()

    if not doctor_id or not date or not appointment_time:
        return jsonify({
            "error": "Doctor, date, and time are required"
        }), 400

    doctor = next(
        (d for d in DEMO_DOCTORS if d["id"] == doctor_id),
        None
    )

    if doctor is None:
        return jsonify({
            "error": "Selected doctor was not found"
        }), 404

    appointment = create_appointment(
        patient_id=user["id"],
        doctor_id=doctor_id,
        doctor_name=doctor["name"],
        date=date,
        time=appointment_time,
        reason=reason,
    )

    return jsonify(appointment), 201


@app.route("/api/appointments", methods=["GET"])
def list_appointments_route():
    token = get_bearer_token()

    if not token:
        return jsonify({
            "error": "Authentication required"
        }), 401

    user = get_user_by_token(token)

    if user is None:
        return jsonify({
            "error": "Invalid or expired login"
        }), 401

    appointments = get_appointments_for_user(user["id"])

    return jsonify(appointments)


# -------------------------------------------------
# General API routes
# -------------------------------------------------

@app.route("/api/time")
def get_current_time():
    return {
        "time": time.time()
    }


# -------------------------------------------------
# Retinal prediction route
# -------------------------------------------------

@app.route("/api/predict", methods=["POST"])
def predict():
    files = request.files.getlist("images")
    patient_id = request.form.get("patient_id", "").strip()
    model = request.form.get("model", "").strip()

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

    if not files or all(f.filename == "" for f in files):
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
        # Replace this placeholder with real AI inference
        # after the CNN models have been trained.
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

@app.route("/api/assessments", methods=["GET"])
def assessments():
    assessment_list = get_assessments()

    return jsonify({
        "assessments": assessment_list
    })
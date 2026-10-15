import os
import time
from io import BytesIO
from datetime import datetime

from flask import Flask, request, jsonify, send_file
from patient_note_visibility import get_hidden_note_ids, hide_note_for_patient
from research_scans_db import init_research_db, save_scans, list_scans, latest_scan, find_image, find_scan
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
    get_appointments_for_doctor,
    get_appointment_by_id,
    update_appointment_status,
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
init_research_db()


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

    # Separate real model research runs from legacy demonstration assessments.
    scan = latest_scan(patient["id"])
    if scan:
        result.update({
            "latest_grade": scan["grade"],
            "latest_label": scan["label"],
            "latest_scan_at": scan["created_at"],
            "latest_confidence": scan["confidence"],
            "latest_scan_id": scan["id"],
            "latest_explanation": "Experimental RETINA26 classification; not a clinical diagnosis.",
            "research_only": True,
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

    # Accept only valid future appointment requests at the API boundary.
    try:
        requested_at = datetime.fromisoformat(f"{date}T{appointment_time}")
    except ValueError:
        return jsonify({"error": "Invalid appointment date or time"}), 400
    if requested_at <= datetime.now():
        return jsonify({"error": "Choose a future appointment time"}), 400

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
        return jsonify({"error": "Authentication required"}), 401

    if user["role"] == "patient":
        appointments = get_appointments_for_user(user["id"])
    elif user["role"] == "doctor":
        appointments = get_appointments_for_doctor(user["id"])
        # Only appointments addressed to this doctor are disclosed.
        for appointment in appointments:
            patient = get_user_by_id(appointment["patient_id"])
            appointment["patient_name"] = (
                patient["full_name"]
                if patient is not None and patient["role"] == "patient"
                else "Patient account"
            )
    else:
        return jsonify({"error": "Invalid account role"}), 403

    return jsonify(appointments)


@app.route("/api/appointments/<appointment_id>/status", methods=["PATCH"])
def change_appointment_status_route(appointment_id):
    doctor = authenticated_user()
    if doctor is None:
        return jsonify({"error": "Authentication required"}), 401
    if doctor["role"] != "doctor":
        return jsonify({"error": "Doctor access required"}), 403

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON request body is required"}), 400
    new_status = str(data.get("status", "")).strip().lower()
    if new_status not in {"confirmed", "declined"}:
        return jsonify({"error": "Invalid status"}), 400

    existing = get_appointment_by_id(appointment_id)
    if existing is None or existing["doctor_id"] != doctor["id"]:
        # Do not reveal which other doctors' appointment IDs exist.
        return jsonify({"error": "Appointment not found"}), 404
    if existing["status"] != "requested":
        return jsonify({"error": "Appointment already processed"}), 409

    updated = update_appointment_status(
        appointment_id, doctor["id"], new_status
    )
    if updated is None:
        return jsonify({
            "error": "Request was already processed or the slot conflicts with a confirmed appointment"
        }), 409
    return jsonify(updated)
# -------------------------------------------------
# Doctor portal
# -------------------------------------------------

def count_today_confirmed_appointments(appointments, today):
    """Count real confirmed appointments on the server-local calendar date."""
    return sum(
        1
        for appointment in appointments
        if appointment["status"] == "confirmed"
        and appointment["date"] == today
    )


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

    patient_ids = get_active_patients_for_doctor(
        doctor["id"]
    )

    awaiting_review = 0

    for patient_id in patient_ids:
        latest = latest_scan(patient_id)
        if latest:
            notes = get_notes_for_patient(patient_id)
            reviewed_by_this_doctor = any(
                note["doctor_id"] == doctor["id"]
                and str(dict(note).get("scan_id") or "") == latest["id"]
                for note in notes
            )
            if not reviewed_by_this_doctor:
                awaiting_review += 1

    confirmed_today = count_today_confirmed_appointments(
        get_appointments_for_doctor(doctor["id"]),
        time.strftime("%Y-%m-%d"),
    )

    return jsonify({
        "active_patients": len(patient_ids),
        "awaiting_review": awaiting_review,
        "todays_visits": confirmed_today,
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

    patient_ids = get_active_patients_for_doctor(
        doctor["id"]
    )

    results = []

    for patient_id in patient_ids:
        patient = get_user_by_id(patient_id)

        if patient is None:
            continue

        if patient["role"] != "patient":
            continue

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

    allowed_patients = get_active_patients_for_doctor(
        doctor["id"]
    )

    if patient_id not in allowed_patients:
        return jsonify({
            "error": "This patient has not granted you access"
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
    allowed_patients = get_active_patients_for_doctor(
        doctor["id"]
    )

    if patient_id not in allowed_patients:
        return jsonify({
            "error": "This patient has not granted you access"
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

    # The patient can hide a note from their portal; the clinician record stays intact.
    hidden_ids = get_hidden_note_ids(patient["id"])
    visible_notes = [note for note in notes if str(note["id"]) not in hidden_ids]
    return jsonify(visible_notes)


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
    # Research-only inference. No images or scores are saved to any database.
    if os.environ.get("RETINA26_RESEARCH_MODE") != "1":
        return jsonify({
            "error": "Model testing is disabled. Start the research server with npm run api:retina",
            "code": "RESEARCH_MODE_DISABLED",
        }), 503

    # Limit request body before Flask parses uploaded multipart data.
    request.max_content_length = 61 * 1024 * 1024
    patient = authenticated_user()
    if patient is None:
        return jsonify({"error": "Sign in as a patient to run a research test"}), 401
    if patient["role"] != "patient":
        return jsonify({"error": "Only patient accounts can test screening"}), 403

    images = request.files.getlist("images")
    if not images or len(images) > 6:
        return jsonify({"error": "Choose between 1 and 6 JPG/PNG photographs"}), 400

    # Reject oversized requests before inference. The individual files are
    # validated by retina26_inference (MIME headers alone are not sufficient).
    if request.content_length and request.content_length > 61 * 1024 * 1024:
        return jsonify({"error": "Upload exceeds the 60 MB size limit"}), 413

    try:
        from retina26_inference import predict_image_bytes
    except ImportError:
        return jsonify({
            "error": "RETINA26 dependencies are missing. Start Flask with npm run api:retina",
            "code": "MODEL_RUNTIME_NOT_READY",
        }), 503

    predictions = []
    entries = []
    for file in images:
        # Never use a client-supplied filename as a filesystem path.
        filename = (file.filename or "image").replace("\\", "/").split("/")[-1]
        raw = file.stream.read(10 * 1024 * 1024 + 1)
        try:
            prediction = predict_image_bytes(raw, filename)
            predictions.append(prediction)
            # Enforce image magic bytes before saving research uploads.
            if raw.startswith(b"\x89PNG\r\n\x1a\n"):
                mime = "image/png"
            elif raw.startswith(b"\xff\xd8\xff"):
                mime = "image/jpeg"
            else:
                return jsonify({"error": f"{filename}: unsupported image format"}), 400
            entries.append((filename, raw, mime, prediction))
        except ValueError as exc:
            return jsonify({"error": f"{filename}: {exc}"}), 400
        except FileNotFoundError as exc:
            return jsonify({"error": str(exc), "code": "MODEL_NOT_READY"}), 503
        except Exception:
            app.logger.exception("RETINA26 inference failed")
            return jsonify({"error": "RETINA26 inference failed; review the Flask terminal"}), 500

    try:
        ids = save_scans(patient["id"], entries)
    except Exception:
        app.logger.exception("Could not save research scan records")
        return jsonify({"error": "Prediction succeeded but could not be saved; please retry"}), 500

    for prediction, scan_id in zip(predictions, ids):
        prediction["scan_id"] = scan_id
        prediction["research_only"] = True
    return jsonify({
        "predictions": predictions,
        "research_only": True,
        "persisted": True,
        "notice": "Experimental RETINA26 research outputs saved to patient test history; not a clinical diagnosis.",
    })

# -------------------------------------------------
# Authenticated RETINA26 research histories and image access
# -------------------------------------------------

@app.route("/api/patients/me/scans", methods=["GET"])
def patient_research_scans():
    patient = authenticated_user()
    if patient is None:
        return jsonify({"error": "Authentication required"}), 401
    if patient["role"] != "patient":
        return jsonify({"error": "Patient access required"}), 403
    return jsonify(list_scans(patient["id"]))


@app.route("/api/doctor/patients/<patient_id>/scans", methods=["GET"])
def doctor_research_scans(patient_id):
    doctor = authenticated_user()
    if doctor is None:
        return jsonify({"error": "Authentication required"}), 401
    if doctor["role"] != "doctor":
        return jsonify({"error": "Doctor access required"}), 403
    if patient_id not in get_active_patients_for_doctor(doctor["id"]):
        return jsonify({"error": "Patient has not granted access"}), 403
    return jsonify(list_scans(patient_id))


@app.route("/api/research-scans/<scan_id>/explanation", methods=["GET"])
def protected_research_explanation(scan_id):
    """Compute a research-only Grad-CAM on demand; never expose it publicly."""
    if os.environ.get("RETINA26_RESEARCH_MODE") != "1":
        return jsonify({"error": "Research mode is disabled"}), 503
    viewer = authenticated_user()
    if viewer is None:
        return jsonify({"error": "Authentication required"}), 401
    scan = find_scan(scan_id)
    if scan is None:
        return jsonify({"error": "Research scan not found"}), 404
    owner_id = scan["patient_id"]
    allowed = viewer["role"] == "patient" and viewer["id"] == owner_id
    if viewer["role"] == "doctor":
        allowed = owner_id in get_active_patients_for_doctor(viewer["id"])
    if not allowed:
        # Same response for non-existent scans and scans without permission.
        return jsonify({"error": "Research scan not found"}), 404
    stored = find_image(scan_id)
    if stored is None:
        return jsonify({"error": "Research image unavailable"}), 404
    try:
        from retina26_explain import explain_image
        explained = explain_image(stored["image_bytes"], expected_grade=int(scan["grade"]))
    except (ValueError, RuntimeError) as exc:
        app.logger.warning("RETINA26 Grad-CAM unavailable: %s", exc)
        return jsonify({"error": "Explanation unavailable for this image. The saved prediction remains unchanged."}), 422
    except Exception:
        app.logger.exception("RETINA26 Grad-CAM failed")
        return jsonify({"error": "Unable to generate AI explanation right now"}), 500
    response = jsonify(explained)
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.route("/api/research-scans/<scan_id>/image", methods=["GET"])
def protected_research_image(scan_id):
    viewer = authenticated_user()
    if viewer is None:
        return jsonify({"error": "Authentication required"}), 401
    scan = find_image(scan_id)
    if scan is None:
        return jsonify({"error": "Image not found"}), 404
    owner_id = scan["patient_id"]
    allowed = (viewer["role"] == "patient" and viewer["id"] == owner_id)
    if viewer["role"] == "doctor":
        allowed = owner_id in get_active_patients_for_doctor(viewer["id"])
    if not allowed:
        return jsonify({"error": "Image not found"}), 404
    response = send_file(BytesIO(scan["image_bytes"]), mimetype=scan["image_mime"])
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


# -------------------------------------------------
# Assessment history
# -------------------------------------------------

@app.route(
    "/api/assessments",
    methods=["GET"]
)
def assessments():
    # The legacy dataset contains prototype predictions without validated
    # provenance. Do not expose them as medical screening records.
    return jsonify({
        "assessments": [],
        "notice": "Historical demonstration predictions are hidden until model integration is complete."
    })


# Patient chooses to remove a clinician note from their own portal.
# This is a soft-removal; the original clinical note is preserved.
@app.route("/api/patients/me/notes/<note_id>", methods=["DELETE"])
def hide_patient_note_route(note_id):
    patient = authenticated_user()
    if patient is None:
        return jsonify({"error": "Authentication required"}), 401
    if patient["role"] != "patient":
        return jsonify({"error": "Patient access required"}), 403

    # A patient must never be able to hide another patient's note.
    own_notes = get_notes_for_patient(patient["id"])
    if not any(str(note["id"]) == str(note_id) for note in own_notes):
        return jsonify({"error": "Note not found"}), 404

    hide_note_for_patient(patient["id"], note_id)
    return jsonify({"ok": True, "removed_from_view": True})

import time
from flask import Flask, request, jsonify
from assessment_db import init_db, add_assessment, update_assessment

app = Flask(__name__)
init_db() #makes sures the assessments table exists when the API starts

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


@app.route('/api/time')
def get_current_time():
    return {'time': time.time()}


@app.route('/api/predict', methods=['POST'])
def predict():
    files = request.files.getlist('images')
    patient_id = request.form.get('patient_id', 'unknown')  
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'No images provided'}), 400

    predictions = []
    for f in files:
        assessment_id = add_assessment(patient_id, f.filename, 'pending')  # Add assessment to the database
        # TODO: replace with real model inference
        # Load the saved .h5 model, preprocess the image, run model.predict()
        grade = 0  # placeholder — hardcoded No DR for now
        info = GRADE_INFO[grade]
        confidence = 0.94  # placeholder confidence score
        update_assessment(assessment_id, grade, info['label'], confidence, info['message'], 'completed')  # Update assessment with results
        predictions.append({
            'filename': f.filename,
            'grade': grade,
            'label': info['label'],
            'confidence': confidence,  # placeholder
            'message': info['message'],
        })

    return jsonify({'predictions': predictions})

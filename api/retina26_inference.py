"""Isolated research inference for the trusted, locally staged YOLO26 checkpoint.

This module does not persist uploaded images or predictions. It must not be
presented as a medical diagnosis or interpreted as a clinical triage tool.
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
from threading import Lock

from PIL import Image, ImageOps, UnidentifiedImageError
from ultralytics import YOLO

MODEL_PATH = Path(__file__).resolve().parent / "models" / "best.pt"
IMAGE_SIZE = 224
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 16_000_000

# Class index order is alphabetical in the checkpoint, NOT medical DR grade order.
GRADE_BY_NAME = {
    "No_DR": 0,
    "Mild": 1,
    "Moderate": 2,
    "Severe": 3,
    "Proliferate_DR": 4,
}
LABEL_BY_NAME = {
    "No_DR": "No DR",
    "Mild": "Mild NPDR",
    "Moderate": "Moderate NPDR",
    "Severe": "Severe NPDR",
    "Proliferate_DR": "Proliferative DR",
}

_model = None
_lock = Lock()


def _load_model():
    global _model
    if _model is None:
        if not MODEL_PATH.is_file():
            raise FileNotFoundError("YOLO26 checkpoint not found at api/models/best.pt")
        model = YOLO(str(MODEL_PATH))
        if model.task != "classify":
            raise RuntimeError(f"Expected classification model, got {model.task!r}")
        names = model.names
        labels = set(names.values() if isinstance(names, dict) else names)
        if labels != set(GRADE_BY_NAME):
            raise RuntimeError(f"Unexpected model class names: {sorted(labels)}")
        _model = model
    return _model


def predict_image_bytes(raw: bytes, filename: str) -> dict:
    """Validate a JPG/PNG image and return an unpersisted research prediction."""
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise ValueError("Each JPG or PNG must be no larger than 10 MB")

    try:
        with Image.open(BytesIO(raw)) as candidate:
            if candidate.format not in {"JPEG", "PNG"}:
                raise ValueError("Only JPG and PNG photographs are supported")
            if candidate.width * candidate.height > MAX_IMAGE_PIXELS:
                raise ValueError("Image dimensions are too large")
            if min(candidate.size) < 128:
                raise ValueError("Image dimensions are too small")
            candidate.load()
            photo = ImageOps.exif_transpose(candidate).convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("The uploaded file is not a readable JPG or PNG image") from exc

    # One-at-a-time inference on CPU keeps concurrent requests from competing.
    with _lock:
        result = _load_model().predict(
            source=photo, imgsz=IMAGE_SIZE, device="cpu", verbose=False
        )[0]

    if result.probs is None:
        raise RuntimeError("The checkpoint did not return classification probabilities")

    idx = int(result.probs.top1)
    name = result.names[idx]
    if name not in GRADE_BY_NAME:
        raise RuntimeError(f"Unknown predicted class: {name!r}")

    # Preserve model-internal class order when mapping each probability to label.
    values = result.probs.data.detach().cpu().tolist()
    probabilities = {
        LABEL_BY_NAME[result.names[i]]: round(float(score), 6)
        for i, score in enumerate(values)
    }
    return {
        "filename": filename,
        "model": "YOLO26 Nano (APTOS research)",
        "grade": GRADE_BY_NAME[name],
        "label": LABEL_BY_NAME[name],
        "confidence": round(float(result.probs.top1conf), 6),
        "probabilities": probabilities,
        "message": (
            "Experimental model-only classification. Not a diagnosis, medical "
            "recommendation, or explanation of retinal findings. Model "
            "confidence is not a calibrated clinical probability."
        ),
    }

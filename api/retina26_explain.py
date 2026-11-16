"""Experimental on-demand Grad-CAM for *trusted* YOLO26 classification weights.

Never describe the highlighted pixels as lesions or clinical evidence.
Model checkpoint is loaded only from the local trusted api/models/best.pt.
"""
from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path
from threading import Lock

import cv2
import numpy as np
import torch
from PIL import Image, ImageOps
from torchvision.transforms import Normalize
from ultralytics import YOLO
from ultralytics.data.augment import classify_transforms

MODEL_PATH = Path(__file__).resolve().parent / "models" / "best.pt"
TARGET_LAYER = "model.6.m.0.m.1.cv2.conv"  # 14x14 in reviewed checkpoint
GRADES = {"No_DR": 0, "Mild": 1, "Moderate": 2, "Severe": 3, "Proliferate_DR": 4}
_LOCK = Lock()
_model = None


def _load_model():
    global _model
    if _model is None:
        if not MODEL_PATH.is_file():
            raise RuntimeError("Missing trained model checkpoint")
        candidate = YOLO(str(MODEL_PATH))
        if candidate.task != "classify" or set(candidate.names.values()) != set(GRADES):
            raise RuntimeError("Unexpected model task or classes")
        _model = candidate
    return _model


def _model_view(tensor: torch.Tensor, transforms):
    data = tensor.detach().cpu()[0].clone()
    for item in getattr(transforms, "transforms", []):
        if isinstance(item, Normalize):
            mean = torch.as_tensor(item.mean, dtype=data.dtype).view(-1, 1, 1)
            std = torch.as_tensor(item.std, dtype=data.dtype).view(-1, 1, 1)
            data = data * std + mean
    return np.uint8(np.rint(data.clamp(0, 1).permute(1, 2, 0).numpy() * 255))


def _mask_for_display(rgb):
    """Approximate retinal foreground, used only to soften the displayed overlay."""
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    foreground = np.uint8((hsv[:, :, 2] > 28) & (hsv[:, :, 1] > 17)) * 255
    foreground = cv2.morphologyEx(foreground, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    contours, _ = cv2.findContours(foreground, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return np.ones(rgb.shape[:2], dtype=np.float32)
    canvas = np.zeros(foreground.shape, dtype=np.uint8)
    cv2.drawContours(canvas, [max(contours, key=cv2.contourArea)], -1, 255, -1)
    if float((canvas > 0).mean()) < 0.22:
        return np.ones(rgb.shape[:2], dtype=np.float32)
    return (cv2.GaussianBlur(canvas, (9, 9), 2) / 255.0).astype(np.float32)


def _jpeg_data_uri(rgb):
    output = BytesIO()
    Image.fromarray(rgb).save(output, format="JPEG", quality=84, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode("ascii")


def explain_image(image_bytes: bytes, expected_grade: int) -> dict:
    """Calculate actual class-specific gradients; do not change saved predictions."""
    if len(image_bytes) > 10 * 1024 * 1024:
        raise ValueError("Research image too large")
    with _LOCK:  # forward hooks and gradients cannot be shared across concurrent requests
        model = _load_model()
        with Image.open(BytesIO(image_bytes)) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
        reference = model.predict(source=image, imgsz=224, device="cpu", verbose=False)[0]
        if reference.probs is None:
            raise RuntimeError("No classification probabilities")
        ref_idx = int(reference.probs.top1)
        label = reference.names[ref_idx]
        if GRADES[label] != expected_grade:
            raise ValueError("Stored grade differs from model; explanation disabled")

        net = model.model.cpu().eval()
        transforms = getattr(net, "transforms", None) or classify_transforms(size=224)
        prepared = transforms(image)
        if not isinstance(prepared, torch.Tensor) or prepared.ndim != 3:
            raise RuntimeError("Unexpected model preprocessing")
        tensor = prepared.unsqueeze(0).float().requires_grad_(True)
        view = _model_view(tensor, transforms)
        modules = dict(net.named_modules())
        if TARGET_LAYER not in modules or "model.10.linear" not in modules:
            raise RuntimeError("Model architecture differs from validated research checkpoint")
        result = {}
        def capture_features(_module, _inputs, output):
            output.retain_grad()
            result["features"] = output
        def capture_logits(_module, _inputs, output):
            result["logits"] = output
        handle_a = modules[TARGET_LAYER].register_forward_hook(capture_features)
        handle_b = modules["model.10.linear"].register_forward_hook(capture_logits)
        try:
            with torch.enable_grad():
                net.zero_grad(set_to_none=True)
                net(tensor)
                logits = result["logits"]
                features = result["features"]
                if int(logits.detach().argmax(dim=1)) != ref_idx:
                    raise ValueError("Preprocessing produced a different classification")
                logits[0, ref_idx].backward()
                if features.grad is None:
                    raise ValueError("Selected layer returned no gradients")
                weights = features.grad.mean(dim=(2, 3), keepdim=True)
                cam = torch.relu((features * weights).sum(dim=1))[0].detach().cpu().numpy()
        finally:
            handle_a.remove()
            handle_b.remove()
            net.zero_grad(set_to_none=True)
        if cam.shape != (14, 14):
            raise RuntimeError(f"Unexpected feature map size: {cam.shape}")
        peak = float(np.max(cam))
        if not np.isfinite(peak) or peak < 1e-12:
            raise ValueError("The selected layer yielded an empty Grad-CAM")
        cam = np.clip(cam / peak, 0, 1)
        h, w = view.shape[:2]
        smooth = np.clip(cv2.resize(cam, (w, h), interpolation=cv2.INTER_CUBIC), 0, 1)
        color = cv2.cvtColor(cv2.applyColorMap(np.uint8(smooth * 255), cv2.COLORMAP_TURBO), cv2.COLOR_BGR2RGB)
        alpha = 0.55 * smooth[..., None] * _mask_for_display(view)[..., None]
        overlay = np.uint8(np.clip(view * (1 - alpha) + color * alpha, 0, 255))
        return {
            "grade": expected_grade,
            "label": label,
            "layer": TARGET_LAYER,
            "method": "Experimental Grad-CAM (14 x 14 feature map)",
            "model_input": _jpeg_data_uri(view),
            "overlay": _jpeg_data_uri(overlay),
            "notice": "Warm colors indicate areas contributing to this class score, not confirmed disease or lesions. The mask is only for display.",
            "research_only": True,
        }

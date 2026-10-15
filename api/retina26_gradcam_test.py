"""Standalone experimental Grad-CAM for trusted YOLO26 classification weights.

Do not use the output as evidence of a lesion or a clinical diagnosis.
The images are saved outside the Git project in LOCALAPPDATA/openI/gradcam-tests.
"""
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image, ImageDraw, ImageOps
from torchvision.transforms import Normalize
from ultralytics import YOLO
from ultralytics.data.augment import classify_transforms

GRADES = {"No_DR": 0, "Mild": 1, "Moderate": 2, "Severe": 3, "Proliferate_DR": 4}


def processed_rgb(image_tensor: torch.Tensor, transforms) -> np.ndarray:
    """Show exactly the resized/cropped/normalized view received by the model."""
    t = image_tensor.detach().cpu()[0].clone()
    for op in getattr(transforms, "transforms", []):
        if isinstance(op, Normalize):
            mean = torch.tensor(op.mean, dtype=t.dtype).view(-1, 1, 1)
            std = torch.tensor(op.std, dtype=t.dtype).view(-1, 1, 1)
            t = t * std + mean
    return (t.clamp(0, 1).permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a research-only Grad-CAM overlay")
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--outdir", type=Path, required=True)
    args = parser.parse_args()

    model_path = args.model.expanduser().resolve()
    image_path = args.image.expanduser().resolve()
    if not model_path.is_file():
        raise FileNotFoundError(f"Model not found: {model_path}")
    if not image_path.is_file():
        raise FileNotFoundError(f"Image not found: {image_path}")

    # Only load a checkpoint from a trusted source. A .pt may contain pickled code.
    yolo = YOLO(str(model_path))
    if yolo.task != "classify":
        raise RuntimeError(f"Expected a classification model, received: {yolo.task}")

    # First run normal inference as a reference for the class/confidence.
    reference = yolo.predict(source=str(image_path), imgsz=224, device="cpu", verbose=False)[0]
    if reference.probs is None:
        raise RuntimeError("Normal inference produced no classification probabilities")
    reference_index = int(reference.probs.top1)
    reference_label = reference.names[reference_index]
    confidence = float(reference.probs.top1conf) * 100

    network = yolo.model.cpu().eval()
    # Ultralytics stores the classification-time transforms on some checkpoints;
    # otherwise this is the documented default classification preprocessing.
    transforms = getattr(network, "transforms", None)
    if transforms is None:
        transforms = classify_transforms(size=224)
    with Image.open(image_path) as img:
        input_image = ImageOps.exif_transpose(img).convert("RGB")
        prepared = transforms(input_image)
    if not isinstance(prepared, torch.Tensor) or prepared.ndim != 3:
        raise RuntimeError("Preprocessing did not return a CHW torch tensor")
    tensor = prepared.unsqueeze(0).float().requires_grad_(True)
    model_view = processed_rgb(tensor, transforms)

    modules = dict(network.named_modules())
    target_name = "model.10.conv.conv"
    classifier_name = "model.10.linear"
    if target_name not in modules or classifier_name not in modules:
        raise RuntimeError(
            "YOLO26 architecture differs from inspection. Available model.10 layers: "
            + ", ".join(k for k in modules if k.startswith("model.10"))
        )

    stored: dict[str, torch.Tensor] = {}

    def feature_hook(_module, _inputs, result):
        if not result.requires_grad:
            raise RuntimeError("No gradient graph for the selected feature layer")
        result.retain_grad()
        stored["features"] = result

    def logit_hook(_module, _inputs, result):
        stored["logits"] = result

    conv_handle = modules[target_name].register_forward_hook(feature_hook)
    linear_handle = modules[classifier_name].register_forward_hook(logit_hook)
    try:
        with torch.enable_grad():
            network.zero_grad(set_to_none=True)
            network(tensor)
            logits = stored.get("logits")
            features = stored.get("features")
            if logits is None or features is None:
                raise RuntimeError("Could not capture classifier logits or feature activations")
            index = int(logits.detach().argmax(dim=1).item())
            if index != reference_index:
                raise RuntimeError(
                    f"Preprocessing mismatch: standard prediction index {reference_index}; "
                    f"Grad-CAM forward prediction index {index}. No heatmap saved."
                )
            logits[0, index].backward()
            gradients = features.grad
            if gradients is None:
                raise RuntimeError("The selected convolutional layer received no gradients")

            weights = gradients.mean(dim=(2, 3), keepdim=True)
            cam = torch.relu((weights * features).sum(dim=1))[0]
            cam = cam.detach().cpu().numpy().astype("float32")
    finally:
        conv_handle.remove()
        linear_handle.remove()

    if cam.ndim != 2 or min(cam.shape) < 2:
        raise RuntimeError(f"Feature map is not spatial enough for Grad-CAM: {cam.shape}")
    mx = float(np.max(cam))
    if not np.isfinite(mx) or mx < 1e-12:
        raise RuntimeError("Grad-CAM is zero/invalid for this layer and image; try another image/layer")
    cam = (cam / mx).clip(0, 1)
    h, w = model_view.shape[:2]
    smooth = cv2.resize(cam, (w, h), interpolation=cv2.INTER_CUBIC).clip(0, 1)
    heat = cv2.cvtColor(
        cv2.applyColorMap((smooth * 255).astype(np.uint8), cv2.COLORMAP_JET),
        cv2.COLOR_BGR2RGB,
    )
    # Blend where activation is stronger, so low-intensity regions stay visible.
    a = (0.55 * smooth[..., None]).astype("float32")
    overlay = np.clip(model_view * (1 - a) + heat * a, 0, 255).astype(np.uint8)

    outdir = args.outdir.expanduser().resolve()
    outdir.mkdir(parents=True, exist_ok=True)
    tag = datetime.now().strftime("%Y%m%d-%H%M%S")
    base = outdir / f"retina26-{tag}"
    Image.fromarray(model_view).save(str(base) + "-model-input.png")
    Image.fromarray(heat).save(str(base) + "-heatmap.png")
    Image.fromarray(overlay).save(str(base) + "-overlay.png")

    # Easy side-by-side comparison for inspection or your capstone notebook.
    picture = Image.new("RGB", (w * 3, h + 38), "white")
    for i, (label, array) in enumerate(
        (("MODEL INPUT", model_view), ("GRAD-CAM", heat), ("OVERLAY", overlay))
    ):
        picture.paste(Image.fromarray(array), (w * i, 38))
        ImageDraw.Draw(picture).text((w * i + 8, 12), label, fill="black")
    comparison = str(base) + "-comparison.png"
    picture.save(comparison)

    print("MODEL PREDICTION:", reference_label)
    print("DR GRADE:", GRADES.get(reference_label, "unmapped"))
    print("MODEL CONFIDENCE:", f"{confidence:.2f}%")
    print("GRAD-CAM TARGET:", target_name)
    print("FEATURE MAP SIZE:", cam.shape)
    print("COMPARISON IMAGE:", comparison)
    print("Important: Heatmap shows model influence, NOT medically confirmed lesions.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
"""Check the supplied YOLO26 APTOS classifier and optionally classify one TEST retinal image.

Usage:
  python retina26_first_test.py path/to/best.pt
  python retina26_first_test.py path/to/best.pt path/to/test-retina.jpg

Run only checkpoints obtained from someone you trust: PyTorch checkpoints may use pickle.
Does not send images anywhere or modify the openI database.
"""
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
import sys

EXPECTED_SHA256 = '1240053ee3e4139362e29af4be006583c7a37beaa946ecfb15005ef4938c3f8b'
CLINICAL_MAP = {
    'No_DR': (0, 'No visible diabetic retinopathy'),
    'Mild': (1, 'Mild non-proliferative DR'),
    'Moderate': (2, 'Moderate non-proliferative DR'),
    'Severe': (3, 'Severe non-proliferative DR'),
    'Proliferate_DR': (4, 'Proliferative DR'),
}

def main() -> int:
    parser = argparse.ArgumentParser(description='Independent test of friend-provided YOLO26 Nano model; no web app changes')
    parser.add_argument('weights', type=Path, help='Path to best.pt')
    parser.add_argument('image', type=Path, nargs='?', help='Optional test retinal photo (JPG/PNG)')
    args = parser.parse_args()

    if not args.weights.is_file():
        print('ERROR: Checkpoint not found:', args.weights)
        return 2
    digest = hashlib.file_digest(open(args.weights, 'rb'), 'sha256').hexdigest()
    if digest != EXPECTED_SHA256:
        print('ERROR: Unexpected checkpoint SHA-256. Refusing to load a different file.')
        print('Actual: ', digest)
        print('Expected:', EXPECTED_SHA256)
        return 2

    try:
        from ultralytics import YOLO
    except ImportError:
        print('Ultralytics is not installed in this Python environment.')
        print('Install it in a dedicated virtual environment first: python -m pip install ultralytics')
        return 3

    print('The checkpoint SHA-256 matches the reviewed uploaded archive.')
    print('Loading trusted PyTorch checkpoint...')
    model = YOLO(str(args.weights))
    if getattr(model, 'task', None) != 'classify':
        print('ERROR: Expected a classification model, got:', getattr(model, 'task', None))
        return 4
    names = {int(index): name for index, name in model.names.items()}
    if set(names.values()) != set(CLINICAL_MAP):
        print('ERROR: Class labels unexpectedly changed:', names)
        return 4
    print('Classification model loaded successfully. Clinical class mappings:')
    for idx, name in sorted(names.items()):
        grade, label = CLINICAL_MAP[name]
        print(f'  Class {idx}: {name} -> Grade {grade} ({label})')

    if args.image is None:
        print('\nPASS: model loaded. No image inference was requested.')
        print('Next: supply a TEST retinal fundus image path as the second argument.')
        return 0
    if not args.image.is_file():
        print('ERROR: Test image not found:', args.image)
        return 2

    from PIL import Image
    try:
        with Image.open(args.image) as im:
            if im.format not in ('JPEG', 'PNG'):
                print('ERROR: Use a JPEG or PNG retinal image.')
                return 2
            im.verify()
    except Exception as e:
        print('ERROR: Invalid image:', e)
        return 2

    predictions = model.predict(source=str(args.image), imgsz=224, device='cpu', verbose=False)
    if len(predictions) != 1 or predictions[0].probs is None:
        print('ERROR: No classification probabilities returned.')
        return 5
    result = predictions[0]
    idx = int(result.probs.top1)
    name = names[idx]
    grade, label = CLINICAL_MAP[name]
    confidence = float(result.probs.top1conf)
    print('\nRESEARCH-ONLY PREDICTION â€” NOT A MEDICAL DIAGNOSIS')
    print('Image:', args.image.name)
    print('Model class:', name)
    print('DR grade:', grade, '-', label)
    print('Top-1 model confidence:', f'{confidence:.1%}')
    print('All class probabilities:')
    for class_idx, class_name in sorted(names.items()):
        print(f'  {class_name:18} {float(result.probs.data[class_idx]):.1%}')
    print('Warning: this model is not validated to rule out DR, especially severe disease.')
    return 0

if __name__ == '__main__':
    sys.exit(main())

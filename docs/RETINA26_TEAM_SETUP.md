# openI RETINA26 - teammate setup (midterm research prototype)

This guide reproduces the application **code and runtime** on another computer. It does **not** copy local user accounts, appointments, saved test images, or databases. RETINA26 is an experimental five-grade classifier and Grad-CAM is a visualization of model influence, not a medical diagnosis or lesion detector.

## What teammates receive from Git

React/TypeScript UI, Flask API, research scan storage logic, appointment/consent workflows, YOLO26 inference code, and Grad-CAM implementation. The trained model weights `best.pt` are **not** in Git and must be shared separately through a trusted, access-controlled method with team authorization.

## Windows setup (tested setup: Python 3.12, PowerShell)

1. Install **Git**, **Node.js** (the version required by this project's current Vite release), and **Python 3.12** with the Windows `py` launcher. Verify with `node --version`, `npm --version`, `py -3.12 --version`.
2. Clone the repository and check out the team's branch: `git fetch origin` then `git switch angies-branch` (or use `git switch --track origin/angies-branch` if not yet local).
3. From the repository root run `npm ci` when `package-lock.json` is present and up to date; otherwise use `npm install` and review any lockfile changes before committing.
4. Run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-retina26.ps1`. This creates `LOCALAPPDATA\openI\retina26-venv`, installs CPU PyTorch/Torchvision, then packages in `api/requirements-retina26.txt`. This may take several minutes.
5. Obtain the **trusted** midterm YOLO26 Nano checkpoint from the model owner and place it at `api/models/best.pt`. Do not rename the checkpoint, upload it to Git, or load an untrusted `.pt` file. The expected SHA256 for the reviewed checkpoint is `1240053ee3e4139362e29af4be006583c7a37beaa946ecfb15005ef4938c3f8b`.
6. Run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-retina26.ps1` and resolve warnings.
7. Start backend: `npm run api:retina` (or `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-retina26.ps1`). In another terminal start frontend: `npm run dev`.
8. Visit `http://localhost:5173`. Register **new test-only** patient and clinician accounts locally, authorize a doctor to view the patient, and test with non-identifiable retinal test images. Existing accounts/history on another laptop are intentionally not transferred.

**Troubleshooting:** Run `py -3.12 --version` if venv setup fails. Flask lives in the RETINA26 environment; running the original `npm run api` with `api/venv` may not enable inference. If `best.pt` is absent, Flask may start but research predictions/Grad-CAM will fail. Use two terminals, and check ports 5000 (Flask) and 5173 (Vite) are not already occupied.

## macOS / Linux notes

The supplied PowerShell setup scripts are **Windows-specific**. The application's Python code can be tested separately on another operating system, but that platform has not been verified. As a starting point: create a Python 3.12 virtual environment, install matching supported PyTorch/Torchvision wheels according to the official PyTorch selector for the target OS, then run `python -m pip install -r api/requirements-retina26.txt`. From `api/`, run Flask with `RETINA26_RESEARCH_MODE=1 python -m flask --app api run --no-debugger`; start React with `npm run dev` from the root. Do not use the Windows `api:retina` npm script on macOS/Linux.

## Privacy, deployment and scientific limitations

- Never commit/upload `*.db`, model checkpoints (`*.pt`), `.env`, or real patient photographs.
- SQLite data is local per computer. This prototype does not sync users/appointments/scans between laptops; a production multi-user deployment would need a secured shared database, backups, authentication hardening, and privacy review.
- Grad-CAM regions only indicate gradients relevant to the classification; they do not prove lesions or clinical findings.
- Per-class sensitivity is uneven: Severe DR was misclassified in an observed test. Present all predictions as experimental.
- Medical data handling, real clinician verification and deployment security are outside the scope of these midterm scripts.

## Before a Git push (repo maintainer)

Run `npm run build` and `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-retina26.ps1`. Confirm Git ignore rules exclude checkpoints, `.env`, SQLite data, generated build files and local venvs. Stage only the intended source paths; inspect `git diff --cached --name-only` and `git diff --cached --check` before committing. Never force-push over teammates' work.

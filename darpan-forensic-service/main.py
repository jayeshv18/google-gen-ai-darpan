from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
import hashlib, os, tempfile, subprocess, json, math
from pathlib import Path
from datetime import datetime
from PIL import Image
from report_generator import build_pdf_report, build_json_report
from scatter_analysis import analyze_image_scatter  # 🆕 new import

app = FastAPI(title="DARPAN Forensic Service")

# ---------- Utility ----------
def sha256sum(file_path):
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            h.update(chunk)
    return h.hexdigest()


def run_cmd(cmd, timeout=30):
    """Safely run CLI commands like exiftool/binwalk/steghide."""
    try:
        return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout).stdout.strip()
    except subprocess.TimeoutExpired:
        return f"{cmd.split()[0]} timed out"


# ---------- Core Analysis ----------
@app.post("/analyze-media-forensics") # <-- CORRECT NAME
async def analyze_media_forensics(file: UploadFile = File(...)):
    """Analyze a media file using EXIF, Binwalk, Steghide, AI heuristics, and scatter analysis."""
    tmp_dir = tempfile.mkdtemp(prefix="darpan_")
    file_path = Path(tmp_dir) / file.filename
    with open(file_path, "wb") as f:
        f.write(await file.read())

    case_id = "DFP-" + sha256sum(file_path)[:12]
    start_time = datetime.utcnow()

    # Run forensic tools
    meta = run_cmd(f"exiftool {file_path}")
    binwalk_data = run_cmd(f"binwalk {file_path}")
    steghide_data = run_cmd(f"steghide info '{file_path}'")

    # --- AI Detection (Entropy-based) ---
    with Image.open(file_path) as img:
        gray = img.convert("L")
        pixels = list(gray.getdata())
        histogram = [0]*256
        for p in pixels:
            histogram[p] += 1
        total = len(pixels)
        entropy = -sum((h/total)*math.log2(h/total) for h in histogram if h != 0)
        ai_score = round(min(entropy / 16, 1.0), 2)

    # --- Scatter Analysis (FFT + correlations) ---
    scatter_results = analyze_image_scatter(str(file_path))

    # --- Build final result object ---
    result = {
        "case_id": case_id,
        "generated_at": start_time.isoformat(),
        "file_name": file.filename,
        "file_sha256": sha256sum(file_path),
        "mime": file.content_type,
        "metadata": {"ExifTool": meta},
        "binwalk": binwalk_data,
        "steghide": steghide_data,
        "ai_detection": {
            "ai_score": ai_score,
            "avg_entropy": round(entropy, 2)
        },
        "scatter_analysis": scatter_results,
        "process_time_s": round((datetime.utcnow() - start_time).total_seconds(), 2)
    }

    # --- Save JSON report ---
    json_path = Path(tmp_dir) / f"{case_id}.json"
    with open(json_path, "w") as f:
        json.dump(result, f, indent=2)

    # --- Generate PDF report ---
    pdf_path = Path(tmp_dir) / f"{case_id}.pdf"
    build_pdf_report(result, str(pdf_path))

    return result


# ---------- Download Report ----------
@app.get("/download")
async def download_report(case_id: str, format: str = "pdf"):
    """Download generated forensic report (PDF or JSON)."""
    # Dynamic lookup in /tmp or project root
    base_dirs = [Path("/tmp"), Path.cwd()]
    file_path = None

    for base in base_dirs:
        candidate = next(base.glob(f"**/{case_id}*.{format}"), None)
        if candidate and candidate.exists():
            file_path = candidate
            break

    if not file_path:
        raise HTTPException(status_code=404, detail=f"Report not found for {case_id}")

    media_type = "application/pdf" if format == "pdf" else "application/json"
    return FileResponse(file_path, media_type=media_type, filename=file_path.name)


from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse, FileResponse
import uuid, os, tempfile, time
from forensic import *
from report_builder import build_json_report, build_pdf_report

app = FastAPI(title="Darpan Forensic Local Service")

DATA_DIR = os.environ.get("DARPAN_DATA", "/tmp/darpan_data")
os.makedirs(DATA_DIR, exist_ok=True)

@app.post("/analyze-media")
async def analyze_media(file: UploadFile = File(...), prompt: str = Form(None)):
    start = time.time()
    case_id = f"DFP-{uuid.uuid4().hex[:12]}"
    # Save upload
    tmpdir = tempfile.mkdtemp(prefix="darpan_")
    upload_path = os.path.join(tmpdir, file.filename)
    with open(upload_path, "wb") as f:
        f.write(await file.read())

    # compute sha256
    file_sha = sha256_from_file(upload_path)
    findings = {}

    # 1) detect mime
    findings["mime"] = detect_mime(upload_path)

    # 2) metadata
    try:
        findings["metadata"] = extract_metadata(upload_path)
    except Exception as e:
        findings["metadata_error"] = str(e)

    # 3) binwalk (raw output)
    try:
        findings["binwalk"] = binwalk_scan(upload_path, extract=False)
    except Exception as e:
        findings["binwalk_error"] = str(e)

    # 4) stego checks
    try:
        findings["steghide"] = steghide_check(upload_path)
    except Exception as e:
        findings["steghide_error"] = str(e)

    if findings["mime"] and "png" in findings["mime"]:
        try:
            findings["zsteg"] = zsteg_check(upload_path)
        except Exception as e:
            findings["zsteg_error"] = str(e)

    # 5) image hashes
    findings["image_hashes"] = image_hashes(upload_path)

    # 6) strings and iocs (trimmed)
    try:
        strings = extract_strings(upload_path, min_len=6)
        findings["strings_sample"] = strings[:40]
    except Exception as e:
        findings["strings_error"] = str(e)

    # 7) entropy
    try:
        ent = entropy_blocks(upload_path, block_size=4096)
        findings["entropy_blocks"] = ent[:50]
    except Exception as e:
        findings["entropy_error"] = str(e)

    # 8) heuristic AI detection (placeholder)
    findings["ai_detection"] = heuristic_ai_score(upload_path)

    # Combine & report
    report_json = build_json_report(case_id=case_id, filename=file.filename, file_sha256=file_sha, findings=findings)
    # Save JSON
    json_path = os.path.join(tmpdir, f"{case_id}.json")
    with open(json_path, "w") as jf:
        json.dump(report_json, jf, indent=2)

    # Build PDF
    pdf_path = os.path.join(tmpdir, f"{case_id}.pdf")
    try:
        build_pdf_report(report_json, pdf_path)
    except Exception as e:
        report_json["pdf_error"] = str(e)

    elapsed = time.time() - start
    report_json["meta"] = {"process_time_s": round(elapsed, 2), "case_id": case_id}

    # return JSON and downloadable pdf link (base: /download?path=)
    return JSONResponse(report_json)

@app.get("/health")
def health():
    return {"status": "ok", "service": "darpan-local-forensics"}

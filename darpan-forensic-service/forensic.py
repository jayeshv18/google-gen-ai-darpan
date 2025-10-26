import subprocess
import json
import tempfile
import os
import hashlib
import shlex
import magic
import math
from PIL import Image
import imagehash

# -----------------------------
# Helpers
# -----------------------------

def sha256_from_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def run_cmd(cmd):
    try:
        output = subprocess.check_output(
            cmd, stderr=subprocess.STDOUT, shell=True, timeout=30
        )
        return output.decode("utf-8", errors="ignore")
    except subprocess.CalledProcessError as e:
        return e.output.decode("utf-8", errors="ignore")
    except Exception as e:
        return f"ERROR: {e}"


def shlex_quote(s):
    return "'" + s.replace("'", "'\"'\"'") + "'"


# -----------------------------
# 1) Metadata via exiftool (JSON)
# -----------------------------
def extract_metadata(filepath):
    cmd = f"exiftool -j {shlex_quote(filepath)}"
    out = run_cmd(cmd)
    try:
        data = json.loads(out)
        return data[0] if isinstance(data, list) and data else {}
    except Exception:
        return {"raw": out}


# -----------------------------
# 2) File type (magic)
# -----------------------------
def detect_mime(filepath):
    try:
        return magic.from_file(filepath, mime=True)
    except Exception:
        return "unknown/unknown"


# -----------------------------
# 3) Binwalk scan (embedded data)
# -----------------------------
def binwalk_scan(filepath, extract=False):
    if extract:
        cmd = f"binwalk -e {shlex_quote(filepath)}"
    else:
        cmd = f"binwalk -y -B --signature {shlex_quote(filepath)}"
    return run_cmd(cmd)


# -----------------------------
# 4) Steghide header check
# -----------------------------
def steghide_check(filepath):
    cmd = f"steghide info {shlex_quote(filepath)}"
    return run_cmd(cmd)


# -----------------------------
# 5) zsteg (PNG stego scan)
# -----------------------------
def zsteg_check(filepath):
    cmd = f"zsteg {shlex_quote(filepath)}"
    return run_cmd(cmd)


# -----------------------------
# 6) Image perceptual hashes
# -----------------------------
def image_hashes(filepath):
    try:
        img = Image.open(filepath).convert("RGB")
        ph = str(imagehash.phash(img))
        ah = str(imagehash.average_hash(img))
        dh = str(imagehash.dhash(img))
        wh = str(imagehash.whash(img))
        return {"phash": ph, "average_hash": ah, "dhash": dh, "whash": wh}
    except Exception as e:
        return {"error": str(e)}


# -----------------------------
# 7) Extract printable strings
# -----------------------------
def extract_strings(filepath, min_len=4):
    results = []
    with open(filepath, "rb") as f:
        data = f.read()

    current = []
    for b in data:
        if 32 <= b < 127:
            current.append(chr(b))
        else:
            if len(current) >= min_len:
                results.append("".join(current))
            current = []
    if len(current) >= min_len:
        results.append("".join(current))
    return results


# -----------------------------
# 8) Entropy map (per-block)
# -----------------------------
def entropy_blocks(filepath, block_size=4096):
    ent = []
    with open(filepath, "rb") as f:
        while True:
            chunk = f.read(block_size)
            if not chunk:
                break
            freq = {}
            for b in chunk:
                freq[b] = freq.get(b, 0) + 1
            length = len(chunk)
            e = 0.0
            for k in freq:
                p = freq[k] / length
                e -= p * math.log2(p)
            ent.append(e)
    return ent


# -----------------------------
# 9) Heuristic AI score (simple)
# -----------------------------
def heuristic_ai_score(filepath):
    """
    Quick heuristic: uses average entropy to estimate if content may be AI-generated.
    Scale: 5–7 typical for photos, 7.5+ often seen in synthetic content.
    Returns probability [0,1].
    """
    ent = entropy_blocks(filepath)
    avg_ent = sum(ent) / len(ent) if ent else 0.0
    score = min(max((avg_ent - 6.0) / 4.0, 0.0), 1.0)
    return {"avg_entropy": round(avg_ent, 3), "ai_score": round(score, 3)}


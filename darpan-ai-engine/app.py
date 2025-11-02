import os
import time
import json
import magic
import traceback
import requests
import vertexai
import io
import hashlib
from concurrent.futures import ThreadPoolExecutor
from google.cloud import firestore
from google.cloud import translate_v2 as translate
from vertexai.generative_models import GenerativeModel
from flask import Flask, request, jsonify
from flask_cors import CORS
from vertexai.language_models import TextEmbeddingModel
from google.cloud import aiplatform
from googleapiclient.discovery import build # For Web Search
from datetime import datetime
from text_forensic import analyze_text_forensics
from google.cloud import vision
import exifread

# ML model imports
import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.applications import EfficientNetB0
from tensorflow.keras.optimizers import Adam
import numpy as np
from PIL import Image
from google.cloud import storage

# --- CONFIGURATION ---
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "AIzaSyCd7b1x_JZPnHUfeD37XGjlONVFRkaFWSo") # Restored from your previous code
SEARCH_ENGINE_ID = os.environ.get("SEARCH_ENGINE_ID", "8428b10238cc84bdb")
PROJECT_ID = os.environ.get("PROJECT_ID", "darpan-project")
LOCATION = os.environ.get("LOCATION", "us-central1")
MODEL_ID = os.environ.get("MODEL_ID", "gemini-2.5-flash")


# Silence TF logs
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

# ---------------------------
# Configuration
# ---------------------------
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "AIzaSyCd7b1x_JZPnHUfeD37XGjlONVFRkaFWSo")
SEARCH_ENGINE_ID = os.environ.get("SEARCH_ENGINE_ID", "8428b10238cc84bdb")
PROJECT_ID = os.environ.get("PROJECT_ID", "darpan-project")
LOCATION = os.environ.get("LOCATION", "us-central1")
MODEL_ID = os.environ.get("MODEL_ID", "gemini-2.5-flash")

# RAG endpoint config
RAG_INDEX_ENDPOINT_ID = os.environ.get("RAG_INDEX_ENDPOINT_ID", "5271518339418554368")
RAG_DEPLOYED_INDEX_ID = os.environ.get("RAG_DEPLOYED_INDEX_ID", "darpan_rag_endpoint_1760863191758")

FORENSIC_SERVICE_URL = os.environ.get("FORENSIC_SERVICE_URL", "https://darpan-forensic-service-361059167059.us-central1.run.app")

MODEL_BUCKET = os.environ.get("MODEL_BUCKET", "darpan-hackathon-us-central1")
MODEL_GCS_PATH = os.environ.get("MODEL_GCS_PATH", "models/artifact-detector/v1_sample/model_weights.h5")
LOCAL_MODEL_PATH = "/tmp/model_weights.h5"
IMG_WIDTH, IMG_HEIGHT = 224, 224

# Trusted corpus
TRUSTED_CORPUS = {
    "fact_1": "Fact-Check regarding 5G and COVID-19. There is no scientific evidence...",
    "fact_2": "Fact-Check regarding mRNA Vaccine. The mRNA vaccines for COVID-19...",
    "fact_3": "Climate Change Consensus: Over 99% of climate scientists agree...",
    "fact_4": "Vaccine Safety - Autism Link Debunked: Numerous large-scale scientific studies...",
    "fact_5": "Moon Landing Hoax Debunked: The Apollo moon landings were real events...",
    "fact_6": "Flat Earth Theory Refuted: The Earth is demonstrably an oblate spheroid...",
    "fact_7": "Chemtrails Conspiracy Theory Explanation: The persistent trails left by airplanes are 'contrails,'...",
    "fact_8": "GMO Safety: Genetically modified organisms (GMOs) available today are considered safe...",
    "fact_9": "Fluoride in Water Benefits: Community water fluoridation is a safe and effective...",
    "fact_10": "Area 51 Explanation: Area 51 is a highly classified United States Air Force facility...",
    "fact_11": "Hollow Earth Theory Debunked: Geological and seismological evidence...",
    "fact_12": "Artificial Sweeteners Safety: Major health organizations worldwide consider...",
    "fact_13": "Lunar Eclipse Explanation: A lunar eclipse occurs when the Earth passes...",
    "fact_14": "Bigfoot/Yeti Existence Unproven: Despite anecdotal reports... no conclusive scientific evidence...",
    "fact_15": "Bermuda Triangle Explained: The Bermuda Triangle is a region... investigations show...",
    "fact_16": "Organic Food vs Conventional Food Health Benefits: ...scientific evidence does not show...",
    "fact_17": "Crop Circles Origin: The vast majority of complex crop circles... are documented man-made hoaxes..."
}

# ---------------------------
# Globals
# ---------------------------
init_error = None
llm_model = None
embedding_model = None
index_endpoint = None
translate_client = None
db = None
artifact_model = None

# ---------------------------
# Utility: Build model blueprint
# ---------------------------
def build_model(learning_rate=0.001):
    print("--- Building EfficientNetB0 model architecture ---")
    base_model = EfficientNetB0(include_top=False, weights='imagenet', input_shape=(IMG_WIDTH, IMG_HEIGHT, 3))
    base_model.trainable = False
    data_augmentation = tf.keras.Sequential([
        layers.RandomFlip("horizontal"),
        layers.RandomRotation(0.2),
    ], name="data_augmentation")
    inputs = layers.Input(shape=(IMG_WIDTH, IMG_HEIGHT, 3))
    x = data_augmentation(inputs)
    x = tf.keras.applications.efficientnet.preprocess_input(x)
    x = base_model(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(1, activation='sigmoid')(x)
    model = models.Model(inputs, outputs)
    model.compile(optimizer=Adam(learning_rate=learning_rate), loss='binary_crossentropy', metrics=['accuracy'])
    print("--- Model built and compiled successfully ---")
    return model

# ---------------------------
# Initialization (run once)
# ---------------------------
try:
    if not PROJECT_ID:
        raise ValueError("PROJECT_ID not configured.")
    print(f"--- (Global Scope) Initializing Vertex AI in {LOCATION} for project {PROJECT_ID} ---")
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    aiplatform.init(project=PROJECT_ID, location=LOCATION)

    print(f"--- (Global Scope) Initializing Vertex AI Models (LLM: {MODEL_ID}) ---")
    llm_model = GenerativeModel(MODEL_ID)
    embedding_model = TextEmbeddingModel.from_pretrained("text-embedding-004")
    print("--- (Global Scope) Vertex AI Models Initialized ---")

    print(f"--- (Global Scope) Connecting to Vector Search Endpoint {RAG_INDEX_ENDPOINT_ID} ---")
    endpoint_path = f"projects/{PROJECT_ID}/locations/{LOCATION}/indexEndpoints/{RAG_INDEX_ENDPOINT_ID}"
    index_endpoint = aiplatform.MatchingEngineIndexEndpoint(index_endpoint_name=endpoint_path)
    print(f"--- (Global Scope) Successfully connected to Vector Search Endpoint ---")

    print(f"--- (Global Scope) Initializing Google Cloud Translate Client ---")
    translate_client = translate.Client()
    print(f"--- (Global Scope) Translate Client Initialized ---")

    print(f"--- (Global Scope) Initializing Firestore Client ---")
    db = firestore.Client(project=PROJECT_ID)
    print(f"--- (Global Scope) Firestore Client Initialized ---")

    # Load artifact model weights from GCS (download to /tmp)
    print(f"--- (Global Scope) Loading ML Artifact Detector Model ---")
    print(f"--- Downloading {MODEL_GCS_PATH} from GCS bucket {MODEL_BUCKET}... ---")
    storage_client = storage.Client()
    bucket = storage_client.bucket(MODEL_BUCKET)
    blob = bucket.blob(MODEL_GCS_PATH)
    blob.download_to_filename(LOCAL_MODEL_PATH)
    print(f"--- Model downloaded to {LOCAL_MODEL_PATH} ---")
    
    artifact_model = build_model()
    artifact_model.load_weights(LOCAL_MODEL_PATH)
    print(f"--- SUCCESSFULLY LOADED TRAINED WEIGHTS INTO ARTIFACT MODEL ---")

except Exception as e:
    init_error = e
    llm_model = embedding_model = index_endpoint = translate_client = db = artifact_model = None
    print(f"!!! (Global Scope) CRITICAL ERROR during Initialization: {e}")
    print(traceback.format_exc())

# ---------------------------
# Flask app & CORS
# ---------------------------
app = Flask(__name__)
CORS(app)

@app.after_request
def add_cors_headers(response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    return response

@app.route('/analyze', methods=['OPTIONS'])
def analyze_preflight():
    return jsonify({"status": "ok"}), 200

@app.route('/analyze-media', methods=['OPTIONS'])
def analyze_media_preflight():
    return jsonify({"status": "ok"}), 200

# ---------------------------
# Helper: Google Search
# ---------------------------
def google_search(query, num=3):
    if not GOOGLE_API_KEY or not SEARCH_ENGINE_ID:
        print("!!! google_search: API Key or Search Engine ID not configured.")
        return "Web search is not configured."
    try:
        service = build("customsearch", "v1", developerKey=GOOGLE_API_KEY)
        res = service.cse().list(q=query, cx=SEARCH_ENGINE_ID, num=num).execute()
        snippets = []
        for item in res.get('items', []):
            snippets.append(f"Title: {item.get('title', 'N/A')}\nSource: {item.get('displayLink', 'N/A')}\nSnippet: {item.get('snippet', 'N/A').replace(chr(10), ' ')}")
        print(f"--- google_search: Found {len(snippets)} web results.")
        return "\n---\n".join(snippets) if snippets else "No relevant web results found."
    except Exception as e:
        print(f"!!! google_search: CRITICAL ERROR - {e.__class__.__name__}: {e}")
        return f"Google Search failed: {e.__class__.__name__}."

# ---------------------------
# Helper: Vector Search
# ---------------------------
def vector_search(query, threshold=0.7):
    global embedding_model, index_endpoint, TRUSTED_CORPUS
    if not embedding_model or not index_endpoint:
        return "RAG components not initialized."
    try:
        query_embedding = embedding_model.get_embeddings([query])[0].values
        response = index_endpoint.find_neighbors(deployed_index_id=RAG_DEPLOYED_INDEX_ID, queries=[query_embedding], num_neighbors=1)
        if response and response[0] and len(response[0]) > 0:
            best = response[0][0]
            if best.distance < threshold:
                return TRUSTED_CORPUS.get(best.id, "No matching facts found.")
        return "No matching facts found in the trusted database."
    except Exception as e:
        print(f"!!! vector_search: Error during query - {e} !!!")
        return f"Trusted fact-check database query failed: {e.__class__.__name__}."

# ---------------------------
# Helper: Translation
# ---------------------------
def translate_report_data(report_json, target_language):
    global translate_client
    if not translate_client or not target_language or target_language.lower().startswith('en'):
        return report_json
    fields = []
    if report_json.get('summary'): fields.append(report_json['summary'])
    for f in report_json.get('factors', []):
        if f.get('name'): fields.append(f['name'])
        if f.get('analysis'): fields.append(f['analysis'])
    learn_more = report_json.get('learn_more', {})
    if learn_more.get('title'): fields.append(learn_more['title'])
    if learn_more.get('explanation'): fields.append(learn_more['explanation'])
    if not fields:
        return report_json
    try:
        print(f"--- translate_report_data: Calling Translation API for target '{target_language}'...")
        results = translate_client.translate(fields, target_language=target_language, source_language='en')
        mapping = {item['input']: item['translatedText'] for item in results}
        
        if report_json.get('summary'):
            report_json['summary'] = mapping.get(report_json['summary'], report_json['summary'])
        for f in report_json.get('factors', []):
            f['name'] = mapping.get(f.get('name', ''), f.get('name', ''))
            f['analysis'] = mapping.get(f.get('analysis', ''), f.get('analysis', ''))
        if learn_more:
            if learn_more.get('title'):
                learn_more['title'] = mapping.get(learn_more['title'], learn_more['title'])
            if learn_more.get('explanation'):
                learn_more['explanation'] = mapping.get(learn_more['explanation'], learn_more['explanation'])
        print("--- translate_report_data: Report fields updated with translations. ---")
        return report_json
    except Exception as e:
        print(f"!!! translate_report_data: Translation API Error: {e}")
        report_json['translation_error'] = str(e)
        return report_json

# ---------------------------
# Helper: ML artifact detector
# ---------------------------
def run_ml_artifact_detector(image_bytes):
    global artifact_model
    if not artifact_model:
        return {"error": "ML model not available."}
    try:
        print("--- RUNNING REAL ML ARTIFACT DETECTOR ---")
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        img = img.resize((IMG_WIDTH, IMG_HEIGHT))
        arr = np.array(img)
        batch = np.expand_dims(arr, axis=0)
        pred = artifact_model.predict(batch, verbose=0)
        score = float(pred[0][0])
        print(f"--- ML MODEL PREDICTION: {score:.4f} ---")
        fake_likelihood_score = 1.0 - score
        return {"artifact_detector": {"artifact_likelihood_score": fake_likelihood_score}}
    except Exception as e:
        print(f"!!! run_ml_artifact_detector error: {e}")
        return {"error": str(e)}

# ---------------------------
# Helper: External forensic service
# ---------------------------
def run_external_forensics(file_bytes, mime_type, filename, timeout=120):
    print(f"--- RUNNING EXTERNAL IMAGE FORENSICS (Calling: {FORENSIC_SERVICE_URL}) ---")
    try:
        files = {'file': (filename, file_bytes, mime_type)}
        resp = requests.post(f"{FORENSIC_SERVICE_URL}/analyze-media-forensics", files=files, timeout=timeout)
        if resp.status_code == 200:
            print("--- EXTERNAL FORENSICS: Report received successfully. ---")
            return resp.json()
        print(f"!!! EXTERNAL FORENSICS Error: {resp.status_code} {resp.text}")
        return {"error": f"forensic service status {resp.status_code}", "details": resp.text}
    except Exception as e:
        print(f"!!! run_external_forensics error: {e}")
        return {"error": str(e)}

# ---------------------------
# Helper: Digital provenance
# ---------------------------
def run_digital_provenance(image_bytes):
    print("--- RUNNING DIGITAL PROVENANCE (Vision API) ---")
    try:
        client = vision.ImageAnnotatorClient()
        image = vision.Image(content=image_bytes)
        resp = client.web_detection(image=image)
        web = resp.web_detection
    except Exception as e:
        print(f"!!! Vision API error: {e}")
        web = None

    prov = {"web_origin": {}, "metadata": {}}
    if web:
        if web.best_guess_labels:
            prov["web_origin"]["best_guess_label"] = web.best_guess_labels[0].label
        if web.full_matching_images:
            prov["web_origin"]["first_seen_url"] = web.full_matching_images[0].url
        pages = []
        for p in getattr(web, "pages_with_matching_images", [])[:5]:
            pages.append({"url": p.url, "title": p.page_title})
        prov["web_origin"]["pages_with_matching_pages"] = pages

    try:
        stream = io.BytesIO(image_bytes)
        tags = exifread.process_file(stream, details=True, stop_tag='UNDEF', strict=False)
        cleaned = {}
        suspicious = []
        for tag, value in tags.items():
            if tag in ('JPEGThumbnail', 'TIFFThumbnail', 'EXIF MakerNote'): continue
            tag_str, val_str = str(tag), str(value.values)
            if tag_str.lower() in ['image software', 'exif image description', 'image description'] and any(k in val_str.lower() for k in ['photoshop', 'gimp', 'ai']):
                suspicious.append(val_str)
            cleaned[tag_str] = val_str
        prov['metadata'] = {"has_metadata": bool(cleaned), "suspicious_tags": suspicious, "all_tags": cleaned}
    except Exception as e:
        print(f"!!! EXIFRead failed: {e}")
        prov['metadata'] = {"error": str(e)}
    print("--- DIGITAL PROVENANCE COMPLETE ---")
    return prov

# ---------------------------
# Helper: Save ledger
# ---------------------------
def save_to_ledger(case_id, report_json, score):
    global db
    if not db:
        print("!!! save_to_ledger: Firestore client not initialized. Skipping.")
        return None
    try:
        rep_str = json.dumps(report_json, sort_keys=True)
        report_hash = hashlib.sha256(rep_str.encode('utf-8')).hexdigest()
        doc_ref = db.collection(u'reports').document(case_id)
        doc_ref.set({
            u'case_id': case_id,
            u'sha256_hash': report_hash,
            u'timestamp': firestore.SERVER_TIMESTAMP,
            u'trust_score': score
        })
        print(f"--- save_to_ledger: Successfully saved report hash for case ID {case_id} ---")
        return report_hash
    except Exception as e:
        print(f"!!! save_to_ledger: FAILED to save report hash to Firestore: {e}")
        return None

# ---------------------------
# Helper: Pruning Functions (FIXED)
# ---------------------------
def prune_forensic_report_for_gemini(raw):
    pruned = {}
    if not isinstance(raw, dict): return {"error": "invalid_forensic_payload"}

    # --- FIX: Check if 'scatter_analysis' is a dict before .get() ---
    scatter_data = raw.get('scatter_analysis', {})
    if isinstance(scatter_data, dict):
        pruned['scatter_summary'] = {
            "synthetic_likelihood": scatter_data.get('synthetic_likelihood', 'N/A')
        }
    else:
        pruned['scatter_summary'] = {"error": "No scatter data"}

    # --- FIX: Check if 'binwalk' is a dict before .get() ---
    binwalk_data = raw.get('binwalk', {})
    if isinstance(binwalk_data, dict):
        pruned['binwalk_summary'] = binwalk_data.get('summary', "No binwalk summary.")
    else:
        pruned['binwalk_summary'] = str(binwalk_data) # It's a string, just pass it

    # --- FIX: Check if 'steghide' is a dict before .get() ---
    steghide_data = raw.get('steghide', {})
    if isinstance(steghide_data, dict):
        pruned['steghide_summary'] = steghide_data.get('summary', "No steghide summary.")
    else:
        pruned['steghide_summary'] = str(steghide_data)

    # --- FIX: Check if 'metadata' is a dict before .get() ---
    metadata_data = raw.get('metadata', {})
    if isinstance(metadata_data, dict):
        exif_data = metadata_data.get('ExifTool', {})
        if isinstance(exif_data, dict):
            pruned['metadata_summary'] = {
                "Software": exif_data.get("Software", "N/A"),
                "ModifyDate": exif_data.get("ModifyDate", "N/A"),
                "CreatorTool": exif_data.get("CreatorTool", "N/A")
            }
        else:
            pruned['metadata_summary'] = "No EXIF data."
    else:
        pruned['metadata_summary'] = "Metadata invalid."
        
    return pruned

def prune_provenance_report_for_gemini(raw):
    pruned = {}
    if not isinstance(raw, dict): return {"error": "invalid_provenance_payload"}
    
    pruned['web_origin'] = raw.get('web_origin', {"error": "No web origin data"})
    
    metadata = raw.get('metadata', {})
    if isinstance(metadata, dict):
        pruned['metadata_summary'] = {
            "has_metadata": metadata.get('has_metadata', False),
            "suspicious_tags": metadata.get('suspicious_tags', [])
        }
    else:
        pruned['metadata_summary'] = {"error": "Metadata invalid."}
        
    return pruned

# ---------------------------
# Endpoint: Text analysis (RESTORED 6-FACTOR PROMPT)
# ---------------------------
@app.route('/analyze', methods=['POST'])
def analyze_content():
    if init_error: return jsonify({"error": f"AI Service initialization failed: {init_error}"}), 500
    if not all([llm_model, embedding_model, index_endpoint, translate_client, db]):
        return jsonify({"error": "AI components missing."}), 500

    start_time = time.time()
    try:
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid JSON"}), 400
        user_query = data.get('query')
        lang = data.get('lang', 'en').split('-')[0]
        if not user_query: return jsonify({"error": "No query"}), 400

        text_forensic_results = analyze_text_forensics(user_query) if lang == 'en' else {"error": f"forensics not for {lang}"}
        rag_results = vector_search(user_query)
        web_results = google_search(user_query)

        system_prompt = f"""
        You are 'Darpan', a neutral, professional, and multilingual AI fact-checking analyst.
        Your task is to synthesize a 'Trusted Compass Report' based *only* on the evidence provided.
        You must analyze the user's text and the JSON evidence block.
        **Important: Respond entirely in English.**

        <user_text>
        {user_query}
        </user_text>

        <evidence>
        {{
            "web_search": {json.dumps(web_results)},
            "rag_search": {json.dumps(rag_results)},
            "text_forensics": {json.dumps(text_forensic_results)}
        }}
        </evidence>

        **Analysis Instructions:**
        1.  **Analyze Evidence:**
            * `rag_search`: This is your *most trusted* source.
            * `web_search`: This is live context. Are the sources reputable?
            * `text_forensics`: This analyzes the *style* (AI-generated, subjectivity).
        2.  **Synthesize & Score:**
            * Generate a `score` from 0 (High Risk) to 100 (Trusted).
            * If `rag_search` or `web_search` *contradict* the claim, the score MUST be low.
            * If `rag_search` or `web_search` *confirm* the claim from reputable sources, the score MUST be high.
        3.  **Generate Report:**
            * **Summary (Critical):** Write a professional, comprehensive summary (at least 2-3 sentences). Start with the final verdict, then *explain the reasoning* by referencing the evidence (e.g., "The user's text... is strongly supported by the provided web search results. Snippets from reputable hospital websites... confirm that...").
            * **Factors (Critical):** Fill out the analysis for all **6 factors** with a detailed explanation.
            * You MUST generate a JSON object in the following format.

        {{
          "score": <int, 0-100>,
          "summary": "<string, A 2-3 sentence, detailed, professional summary explaining the verdict by referencing the evidence.>",
          "factors": [
            {{
              "name": "Source Credibility",
              "analysis": "<string, Detailed analysis of web_search sources. Example: 'Web search yielded results from established healthcare providers... which are considered credible sources.'>",
              "score": <int, 0-100>
            }},
            {{
              "name": "Fact-Checking",
              "analysis": "<string, Detailed analysis of RAG and Web. Example: 'The core claims are directly corroborated by the web search results... No conflicting information was found...'>",
              "score": <int, 0-100>
            }},
            {{
              "name": "Language Analysis",
              "analysis": "<string, Detailed analysis of text_forensics. Example: 'The user's text employs neutral, objective, and informative language...'>",
              "score": <int, 0-100>
            }},
            {{
              "name": "Bias Detection",
              "analysis": "<string, Detailed analysis of bias. Example: 'The text presents a widely accepted medical viewpoint... with no discernible bias...'>",
              "score": <int, 0-100>
            }},
            {{
              "name": "Evidence Quality",
              "analysis": "<string, Analysis of the evidence. Example: 'The context provides strong evidence in the form of recommendations from reputable medical institutions...'>",
              "score": <int, 0-100>
            }},
            {{
              "name": "Contextual Accuracy",
              "analysis": "<string, Analysis of claim accuracy. Example: 'The user's claim... is directly reflected and confirmed by the web search results. There is no misrepresentation.'>",
              "score": <int, 0-100>
            }}
          ],
          "report_payload": {{
            "rag_hits": "<string, (Omitted from prompt)>",
            "web_hits": "<string, (Omitted from prompt)>"
          }},
          "learn_more": {{
            "title": "Text Analysis Deep Dive",
            "explanation": "This report was generated by cross-referencing web results and our internal fact-check database. The text itself was also analyzed for linguistic anomalies, bias, and sentiment."
          }}
        }}
        """
        print(f"--- /analyze: Calling {MODEL_ID} (Text) with {len(system_prompt)} char prompt... ---")
        response = llm_model.generate_content([system_prompt], generation_config={"response_mime_type": "application/json"})
        response_text = response.text
        print(f"--- /analyze: Received raw English JSON response ({len(response_text)} chars). ---")
        
        report_data = json.loads(response_text)
        if "score" not in report_data or "summary" not in report_data:
            raise ValueError("Gemini response missing required keys")

        report_data = translate_report_data(report_data.copy(), lang)
        report_data['text_forensics'] = text_forensic_results
        case_id = f"text-{int(time.time())}"
        report_data['caseId'] = case_id
        report_hash = save_to_ledger(case_id, report_data, report_data.get('score'))
        report_data['sha256_hash'] = report_hash
        
        elapsed = time.time() - start_time
        print(f"--- /analyze: Success. Language: '{lang}'. Time: {elapsed:.2f}s ---")
        return jsonify(report_data), 200

    except Exception as e:
        elapsed = time.time() - start_time
        print(f"--- /analyze EXCEPTION HANDLER. Time: {elapsed:.2f}s ---")
        print(traceback.format_exc())
        return jsonify({"error": f"An internal server error occurred: {str(e)}"}), 500

# ---------------------------
# Endpoint: Media analysis (RESTORED 9-FACTOR PROMPT)
# ---------------------------
@app.route('/analyze-media', methods=['POST'])
def analyze_media():
    if init_error: return jsonify({"error": f"AI Service initialization failed: {init_error}"}), 500
    if not all([llm_model, embedding_model, index_endpoint, translate_client, db, artifact_model]):
        return jsonify({"error": "AI components missing."}), 500

    start_time = time.time()
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
        
        file = request.files['file']
        prompt = request.form.get('prompt', '') or ''
        lang = request.form.get('lang', 'en').split('-')[0] # Get lang from form
        filename = file.filename or "upload.jpg"
        
        file.seek(0)
        file_bytes = file.read()
        if not file_bytes:
            return jsonify({"error": "empty file"}), 400
        mime_type = magic.from_buffer(file_bytes, mime=True)
        print(f"--- /analyze-media: Received '{filename}', mime: {mime_type}, size: {len(file_bytes)} bytes ---")

        # --- Run all analysis modules in parallel (IO-bound) ---
        evidence = {}
        evidence_for_gemini = {}
        tasks = {}
        with ThreadPoolExecutor(max_workers=5) as ex:
            tasks['forensic'] = ex.submit(run_external_forensics, file_bytes, mime_type, filename, 120)
            tasks['provenance'] = ex.submit(run_digital_provenance, file_bytes)
            tasks['ml'] = ex.submit(run_ml_artifact_detector, file_bytes)
            tasks['web'] = ex.submit(google_search, prompt)
            tasks['rag'] = ex.submit(vector_search, prompt)

        # Collect results
        for name, future in tasks.items():
            try:
                res = future.result(timeout=125) # 125s total timeout
            except Exception as e:
                print(f"!!! Task {name} failed: {e}")
                res = {"error": str(e)}
            
            evidence_key_map = {
                'forensic': 'forensic_report',
                'provenance': 'provenance_report',
                'ml': 'ml_model_report',
                'web': 'web_hits',
                'rag': 'rag_hits'
            }
            evidence[evidence_key_map[name]] = res

        # --- Build PRUNED evidence for Gemini (small) ---
        evidence_for_gemini['forensic_service_report'] = prune_forensic_report_for_gemini(evidence.get('forensic_report', {}))
        evidence_for_gemini['digital_provenance'] = prune_provenance_report_for_gemini(evidence.get('provenance_report', {}))
        evidence_for_gemini['ml_artifact_detector'] = evidence.get('ml_model_report', {})
        evidence_for_gemini['web_search'] = evidence.get('web_hits', [])
        evidence_for_gemini['rag_search'] = evidence.get('rag_hits', {})
        
        print("--- /analyze-media: All analysis modules complete. ---")
        
        # --- ** RESTORED 9-FACTOR PROMPT (LIKE YOUR OLD SCREENSHOT) ** ---
        system_prompt = f"""
        You are 'Darpan', a neutral, professional, and multilingual AI fact-checking analyst.
        Your task is to synthesize a 'Trusted Compass Report' based *only* on the evidence provided.
        You must analyze the user's prompt (the claim) AND the image, plus all the forensic evidence.
        **Important: Respond entirely in English.**

        <user_prompt_claim>
        {prompt}
        </user_prompt_claim>

        <evidence>
        {json.dumps(evidence_for_gemini)}
        </evidence>

        **Analysis Instructions & Evidence Weighting:**
        1.  **Analyze All Evidence:**
            * `digital_provenance`: This is your *most critical* evidence. Look at `web_origin.first_seen_url` (is it old?), `best_guess_label` (does it match?), and `metadata_summary.suspicious_tags` (Photoshop?).
            * `forensic_service_report`: This is your second most critical. Look at `scatter_summary.synthetic_likelihood` (is it high?), `metadata_summary.Software` (does it confirm Photoshop?).
            * `ml_artifact_detector`: This is your new REAL model. `artifact_likelihood_score` is the probability the image is FAKE (0.0 to 1.0). A score > 0.7 is a strong sign of AI generation.
            * `web_search` / `rag_search`: Use this to check the *user's prompt_claim*. Is the *event* real?
        2.  **Synthesize & Score:**
            * Generate a `score` from 0 (High Risk) to 100 (Trusted).
            * If `digital_provenance`, `forensic_service_report`, or `ml_artifact_detector` show strong proof of manipulation, the score MUST be low (< 30).
        3.  **Generate Report:**
            * **Summary (Critical):** Write a professional, comprehensive summary (at least 2-3 sentences). Start with the final verdict, then *explain the reasoning* by referencing the specific evidence (e.g., "The image is likely AI-generated. The 'ML Forensic Analysis' model detected a 92% (0.92) likelihood of generative artifacts. This is supported by the 'Scatter Analysis' from the forensic report...").
            * **Factors (Critical):** Fill out the analysis for all **9 factors** with a detailed explanation.
            * You MUST generate a JSON object in the following format.

        {{
          "score": <int, 0-100>,
          "summary": "<string, A 2-3 sentence, detailed, professional summary explaining the verdict by referencing ALL evidence.>",
          "factors": [
            {{
              "name": "Visual Consistency",
              "analysis": "<string, Your visual analysis of lighting, shadows, and focus.>",
              "score": <int, 0-100>
            }},
            {{
              "name": "Object Integrity",
              "analysis": "<string, Your visual analysis of hands, faces, text, and objects.>",
              "score": <int, 0-100>
            }},
            {{
              "name": "Contextual Plausibility",
              "analysis": "<string, Does this scene make sense? (e.g., 'A pope in a puffer jacket is highly implausible.')>",
              "score": <int, 0-100>
            }},
            {{
              "name": "Manipulation Signs",
              "analysis": "<string, Your visual analysis for blurring, pixel mismatches, etc.>",
              "score": <int, 0-100>
            }},
            {{
              "name": "Metadata Analysis",
              "analysis": "<string, Synthesize findings from 'digital_provenance.metadata_summary' and 'forensic_service_report.metadata_summary'. (e.g., 'EXIF data was stripped and 'Photoshop' tag was found.')>",
              "score": <int, 0-100>
            }},
            {{
              "name": "Binary Structure",
              "analysis": "<string, Summarize the 'forensic_service_report.binwalk_summary' findings. (e.g., 'Binwalk analysis found no embedded files.')>",
              "score": <int, 0-100>
            }},
            {{
              "name": "Steganography Check",
              "analysis": "<string, Summarize the 'forensic_service_report.steghide_summary' findings. (e.g., 'Steghide check was negative.')>",
              "score": <int, 0-100>
            }},
            {{
              "name": "Provenance Check",
              "analysis": "<string, Summarize the 'digital_provenance.web_origin' findings. (e.g., 'Reverse image search was inconclusive' or 'Image first seen in 2018...')>",
              "score": <int, 0-100>
            }},
            {{
              "name": "ML Forensic Analysis",
              "analysis": "<string, Summarize the 'ml_artifact_detector.artifact_detector.artifact_likelihood_score'. (e.g., 'The ML model detected a 0.85 (85%) likelihood of AI-generated artifacts.')>",
              "score": <int, 0-100>
            }}
          ],
          "report_payload": {{
            "rag_hits": "<string, (Omitted from prompt, will be populated in final code)>",
            "web_hits": "<string, (Omitted from prompt, will- be populated in final code)>",
            "provenance_report": "<object, (Omitted from prompt, will be populated in final code)>",
            "forensic_report": "<object, (Omitted from prompt, will be populated in final code)>",
            "ml_model_report": "<object, (Omitted from prompt, will be populated in final code)>"
          }},
          "learn_more": {{
            "title": "Digital Provenance & Forensic Report",
            "explanation": "This report was generated by a hybrid system. It includes a Digital Provenance check (reverse image search and EXIF data) and a Deep Forensic Analysis (metadata, binary structure, and manipulation analysis)."
          }}
        }}
        """

        prompt_size = len(system_prompt)
        print(f"--- /analyze-media: Calling {MODEL_ID} (Media) with {prompt_size} char prompt... ---")
        
        response = llm_model.generate_content([system_prompt], generation_config={"response_mime_type": "application/json"})
        response_text = response.text
        print(f"--- /analyze-media: Received raw English JSON response ({len(response_text)} chars). ---")

        report_data = json.loads(response_text)
        if "score" not in report_data or "summary" not in report_data:
            raise ValueError("Gemini response missing required keys")

        # Add the full evidence payload *after* parsing Gemini's response
        report_data['report_payload'] = {
            "rag_hits": evidence.get('rag_hits'),
            "web_hits": evidence.get('web_hits'),
            "provenance_report": evidence.get('provenance_report'),
            "forensic_report": evidence.get('forensic_report'),
            "ml_model_report": evidence.get('ml_model_report')
        }

        # Translate & ledger
        report_data = translate_report_data(report_data.copy(), lang)
        case_id = f"media-{int(time.time())}"
        report_data['caseId'] = case_id
        report_hash = save_to_ledger(case_id, report_data, report_data.get('score'))
        report_data['sha256_hash'] = report_hash

        elapsed = time.time() - start_time
        print(f"--- /analyze-media: Success. Language: '{lang}'. Time: {elapsed:.2f}s ---")
        return jsonify(report_data), 200

    except Exception as e:
        elapsed = time.time() - start_time
        print(f"--- /analyze-media EXCEPTION HANDLER. Time: {elapsed:.2f}s ---")
        print(traceback.format_exc())
        return jsonify({"error": f"An internal server error occurred: {str(e)}"}), 500

# ---------------------------
# Healthcheck
# ---------------------------
@app.route('/health', methods=['GET'])
def health_check():
    if init_error:
        return jsonify({"status": "error", "message": str(init_error)}), 500
    status = {
        "llm_model": bool(llm_model),
        "embedding_model": bool(embedding_model),
        "index_endpoint": bool(index_endpoint),
        "translate_client": bool(translate_client),
        "db": bool(db),
        "artifact_model": bool(artifact_model)
    }
    ok = all(status.values())
    return jsonify({"status": "ok" if ok else "error", "services": status}), (200 if ok else 500)

# ---------------------------
# Run
# ---------------------------
if __name__ == '__main__':
<<<<<<< HEAD
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)), debug=False)
=======
    port = int(os.environ.get("PORT", 8080))
    print(f"--- Starting Flask Server for Gunicorn on port {port} in {LOCATION} with {MODEL_ID} ---")
    app.run(debug=False, host='0.0.0.0', port=port)
>>>>>>> e900b6c91c892cb9896f1244efaf19fb0b2d2722

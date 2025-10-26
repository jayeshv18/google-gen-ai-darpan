import os
import time
import json
import magic
import traceback
import requests  # For calling the forensic service
import vertexai
from vertexai.generative_models import GenerativeModel, Part
from flask import Flask, request, jsonify
from flask_cors import CORS
from vertexai.language_models import TextEmbeddingModel
from google.cloud import aiplatform
from googleapiclient.discovery import build # For Web Search
from datetime import datetime # For Report Payload

# --- CONFIGURATION ---
GOOGLE_API_KEY = "" # Replace if needed
SEARCH_ENGINE_ID = "8428b10238cc84bdb" # Replace if needed
PROJECT_ID = "darpan-project"
LOCATION = "us-central1"
MODEL_ID = "gemini-2.5-flash" # The model that worked!

# --- RAG Endpoint Config ---
RAG_INDEX_ENDPOINT_ID = "5271518339418554368"
RAG_DEPLOYED_INDEX_ID = "darpan_rag_endpoint_1760863191758"

# --- FORENSIC SERVICE URL ---
# The live URL of your *other* service
FORENSIC_SERVICE_URL = "https://darpan-forensic-service-361059167059.us-central1.run.app"

# ---------------------------

# --- TRUSTED "BRAIN" (Full 17 facts) ---
TRUSTED_CORPUS = {
    "fact_1": "Fact-Check regarding 5G and COVID-19. There is no scientific evidence linking 5G technology to the spread of COVID-19. The World Health Organization (WHO) states that viruses cannot travel on radio waves or mobile networks. COVID-19 is spread through respiratory droplets when an infected person coughs, sneezes, or speaks. 5G is a mobile network technology, and the claims of it causing or spreading the virus are a harmful conspiracy theory.",
    "fact_2": "Fact-Check regarding mRNA Vaccine. The mRNA vaccines for COVID-19 (like Pfizer and Moderna) do not alter human DNA. The 'm' in mRNA stands for 'messenger.' The vaccine provides instructions to your cells to build a piece of the 'spike protein' from the virus, which triggers an immune response. The mRNA never enters the nucleus of the cell, which is where our DNA is kept. After the instructions are used, the cell breaks down and disposes of the mRNA. This technology has been researched for decades.",
    "fact_3": "Climate Change Consensus: Over 99% of climate scientists agree that climate change is happening and that human activity is the primary driver, mainly through the burning of fossil fuels. This consensus is based on multiple lines of evidence from diverse scientific disciplines. Claims dismissing this consensus often lack peer-reviewed support.",
    "fact_4": "Vaccine Safety - Autism Link Debunked: Numerous large-scale scientific studies worldwide have conclusively shown there is no link between vaccines (including the MMR vaccine) and autism. The original study suggesting a link was retracted due to serious methodological flaws and ethical violations. Vaccines are a safe and effective public health tool.",
    "fact_5": "Moon Landing Hoax Debunked: The Apollo moon landings were real events witnessed globally and supported by vast amounts of physical evidence, including moon rocks, photographs, mission data, and independent tracking by other nations. Conspiracy theories claiming the landings were faked ignore physics, technological evidence, and the sheer scale of the operation.",
    "fact_6": "Flat Earth Theory Refuted: The Earth is demonstrably an oblate spheroid, not flat. Evidence includes satellite imagery, gravity measurements, the way ships disappear over the horizon hull-first, lunar eclipses showing Earth's curved shadow, and the experiences of astronauts and pilots circumnavigating the globe. Flat Earth theories contradict basic physics and observable reality.",
    "fact_7": "Chemtrails Conspiracy Theory Explanation: The persistent trails left by airplanes are condensation trails, or 'contrails,' primarily composed of water vapor that freezes into ice crystals at high altitudes. They are not 'chemtrails' containing secret chemical or biological agents sprayed for nefarious purposes. Scientific analysis of contrails confirms they consist of water, carbon dioxide, and trace engine exhaust components, consistent with normal flight operations.",
    "fact_8": "GMO Safety: Genetically modified organisms (GMOs) available today are considered safe to eat. Decades of scientific research and regulatory reviews worldwide have found no evidence that GMOs pose any unique health risks compared to conventionally bred crops. GMOs are often developed for beneficial traits like pest resistance or enhanced nutrition.",
    "fact_9": "Fluoride in Water Benefits: Community water fluoridation is a safe and effective public health measure to prevent tooth decay. Scientific evidence overwhelmingly supports that fluoride levels used in public water systems significantly reduce cavities and pose no known health risks. Claims linking it to serious illnesses like cancer are unsubstantiated.",
    "fact_10": "Area 51 Explanation: Area 51 is a highly classified United States Air Force facility in Nevada. While its primary purpose is publicly unknown, it's historically been used for the development and testing of experimental aircraft and weapons systems (like the U-2 spy plane). Claims of it housing extraterrestrial spacecraft or aliens are popular in fiction but lack credible evidence.",
    "fact_11": "Hollow Earth Theory Debunked: Geological and seismological evidence overwhelmingly confirms that the Earth has a solid inner core, a liquid outer core, a mantle, and a crust. There is no scientific basis for the theory that the Earth is hollow or contains hidden civilizations within. Seismic waves traveling through the Earth provide detailed information about its internal structure.",
    "fact_12": "Artificial Sweeteners Safety: Major health organizations worldwide (like the FDA and EFSA) consider approved artificial sweeteners (e.g., aspartame, sucralose) safe for consumption within acceptable daily intake levels. While research is ongoing, current scientific evidence does not support claims that they cause significant harm like cancer when consumed in typical amounts.",
    "fact_13": "Lunar Eclipse Explanation: A lunar eclipse occurs when the Earth passes directly between the Sun and the Moon, casting a shadow on the Moon. It does not involve mythical creatures or herald specific doom. The reddish color ('blood moon') is due to sunlight filtering through Earth's atmosphere. These events are predictable astronomical phenomena.",
    "fact_14": "Bigfoot/Yeti Existence Unproven: Despite anecdotal reports and blurry images or footprints, there is no conclusive scientific evidence (like DNA, clear photographs/videos, or fossil records) to confirm the existence of large, ape-like creatures such as Bigfoot or the Yeti. Most evidence presented is either misidentification, hoaxes, or lacks scientific rigor.",
    "fact_15": "Bermuda Triangle Explained: The Bermuda Triangle is a region in the North Atlantic Ocean where some aircraft and ships are said to have disappeared under mysterious circumstances. However, investigations and statistical analyses show that the number of disappearances in this area is not significantly higher than in any other heavily trafficked part of the ocean. Many 'mysteries' have conventional explanations (e.g., weather, human error).",
    "fact_16": "Organic Food vs Conventional Food Health Benefits: While organic farming practices avoid synthetic pesticides and fertilizers, scientific evidence does not show a significant nutritional or overall health benefit from eating organic food compared to conventionally grown food. Both can be part of a healthy diet. Pesticide residues on conventional foods are generally well below safety limits.",
    "fact_17": "Crop Circles Origin: The vast majority of complex crop circles, particularly those appearing in the UK since the 1970s, are documented man-made hoaxes created by flattening crops, often at night, using simple tools like ropes and boards. While some simple circles might be caused by weather phenomena, claims of extraterrestrial or paranormal origins lack credible evidence."
}
# -----------------------------

app = Flask(__name__)
CORS(app) # Allow all origins

# --- Initialize Vertex AI and Models (Global Scope) ---
llm_model = None
embedding_model = None
index_endpoint = None
init_error = None
try:
    print(f"--- (Global Scope) Initializing Vertex AI in {LOCATION} ---")
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    aiplatform.init(project=PROJECT_ID, location=LOCATION)
    print("--- (Global Scope) Initializing Vertex AI Models ---")
    llm_model = GenerativeModel(MODEL_ID)
    embedding_model = TextEmbeddingModel.from_pretrained("text-embedding-004")
    print(f"--- (Global Scope) Vertex AI Models Initialized: Using LLM '{MODEL_ID}' ---")

    print(f"--- (Global Scope) Connecting to Vector Search Endpoint in {LOCATION} ---")
    endpoint_path = f"projects/{PROJECT_ID}/locations/{LOCATION}/indexEndpoints/{RAG_INDEX_ENDPOINT_ID}"
    index_endpoint = aiplatform.MatchingEngineIndexEndpoint(index_endpoint_name=endpoint_path)
    print(f"--- (Global Scope) Successfully connected to Vector Search Endpoint: {endpoint_path} ---")

except Exception as e:
    init_error = e
    print(f"!!! (Global Scope) CRITICAL ERROR during Initialization: {e}")
    print(traceback.format_exc())
# --- End Initialization ---


# --- google_search function ---
def google_search(query):
    print(f"--- google_search: Performing search for query: {query[:50]}... ---")
    try:
        snippets = []
        service = build("customsearch", "v1", developerKey=GOOGLE_API_KEY)
        res = service.cse().list(q=query, cx=SEARCH_ENGINE_ID, num=3).execute()
        if 'items' in res:
             for item in res['items']:
                 snippet_text = item.get('snippet', 'N/A').replace('\n', ' ')
                 link = item.get('link', '#')
                 display_link = item.get('displayLink', 'N/A')
                 snippets.append(f"Source: {display_link} ({link})\nSnippet: {snippet_text}")
        print(f"--- google_search: Found {len(snippets)} web results.")
        return "\n---\n".join(snippets) if snippets else "No relevant web results found."
    except Exception as e:
        print(f"!!! google_search: Error - {e}")
        return "Google Search failed."


# --- vector_search function ---
def vector_search(query):
    global embedding_model, index_endpoint
    print(f"--- vector_search: Performing search for query: {query[:50]}... ---")
    if not embedding_model or not index_endpoint:
        return "RAG components not initialized."
    try:
        query_vector = embedding_model.get_embeddings([query])[0].values
        print(f"--- vector_search: Query vector generated. ---")
        response = index_endpoint.find_neighbors(
            deployed_index_id=RAG_DEPLOYED_INDEX_ID,
            queries=[query_vector],
            num_neighbors=1
        )
        print(f"--- vector_search: Raw response received: {response} ---")
        
        retrieved_text = "No matching facts found in the trusted database."
        if response and response[0]:
            best_match = response[0][0]
            # Assuming lower distance is better (Euclidean)
            if best_match.distance < 0.7: 
                corpus_match = TRUSTED_CORPUS.get(best_match.id)
                if corpus_match:
                    print(f"--- vector_search: Best match found: ID='{best_match.id}' ---")
                    retrieved_text = corpus_match
        return retrieved_text
    except Exception as e:
        print(f"!!! vector_search: Error during query - {e} !!!")
        return "Trusted fact-check database query failed."


# --- Endpoint 1: Text Analysis (RAG + Web Search) ---
@app.route('/analyze', methods=['POST'])
def analyze_content():
    print(f"--- /analyze ENTRY (LIVE - {LOCATION} / {MODEL_ID}) ---")
    if init_error: return jsonify({"error": f"AI Service initialization failed: {init_error}"}), 500
    if not all([llm_model, embedding_model, index_endpoint]):
        return jsonify({"error": "AI Service components not available."}), 500

    try:
        data = request.get_json()
        user_query = data.get('query') # <-- Frontend sends 'query'
        if not user_query: return jsonify({"error": "Query not provided"}), 400
        
        print(f"--- /analyze: Received Query: {user_query[:100]}... ---")
        web_results = google_search(user_query)
        rag_results = vector_search(user_query)
        print("--- /analyze: RAG/Web search lookups completed ---")

        # The enhanced prompt for text
        prompt = f"""
        Act as a "Trust Analysis" engine. Analyze the User's Text for misinformation, credibility, bias, and manipulation based *strictly* on the provided context (Web Search Results, Trusted Database Results). Do not use external knowledge.

        Your response MUST be a single, valid JSON object with NO other text before or after it. The JSON object must have the exact top-level keys: "score", "analysis", "factors", and "learn_more".

        1.  **"score"**: Integer 0-100. Base heavily on alignment with Trusted DB/Web Search. High score indicates the claim is well-supported by credible context; low score indicates contradiction, lack of evidence, or misleading framing based on context.

        2.  **"analysis"**: Provide a **detailed analysis summary** (2-4 sentences). Explain the reasoning behind the score, referencing specific findings from the Web Search or Trusted DB context. Explicitly state if the core claim was confirmed, refuted, or unverified by the context.

        3.  **"factors"**: Array of exactly six JSON objects ("label", "value", "sentiment"). For each 'value', provide a **detailed explanation (1-2 sentences)** justifying the assessment based *only* on the provided context:
            * "Source Credibility": Explain the nature and reliability of sources found in Web Search (e.g., "Web search yielded results from established scientific journals and reputable news outlets like BBC.", "Context includes links to personal blogs and forums lacking editorial oversight."). State N/A if no relevant web results. Assign 'sentiment'.
            * "Fact-Checking": Explain whether the Trusted DB or Web Search context directly supports or contradicts the core claim (e.g., "The Trusted DB directly refutes this claim with Fact ID X.", "Web search results from health organizations contradict the user's statement."). Assign 'sentiment'.
            * "Language Analysis": Explain the characteristics of the user's language (e.g., "The text uses neutral, objective language suitable for factual reporting.", "The text employs emotionally charged words and urgent calls to action, typical of persuasive or alarmist content."). Assign 'sentiment'.
            * "Bias Detection": Explain any discernible bias or specific viewpoint promoted in the user's text compared to the context (e.g., "The text presents a one-sided argument, ignoring counter-evidence found in web search.", "The language suggests a strong political bias against the policy mentioned."). State N/A if neutral. Assign 'sentiment'.
            * "Evidence Quality": Explain the type and strength of evidence presented *within the provided context* (e.g., "Context includes references to peer-reviewed studies providing strong evidence.", "The only evidence cited in context is anecdotal testimony."). Assign 'sentiment'.
            * "Contextual Accuracy": Explain how accurately the user's claim reflects the nuances or findings within the provided context (e.g., "The claim accurately summarizes the findings reported in the web search results.", "The claim cherry-picks data from the context, presenting a misleading picture."). Assign 'sentiment'.

        4.  **"learn_more"**: An object containing educational information with the exact keys: "title", "explanation", and "sources".
            * **"title"**: A concise, educational heading that helps users understand the misinformation. Examples: 
            - "Myth vs Reality: Understanding the Facts"
            - "Know Before You Share"
            - "Why This Claim Is Misleading"    
            - "Learn the Truth About [Topic]". Choose one that matches the claim type and tone of the analysis.
            * **"explanation"**: A brief (2-3 sentences) educational note explaining *why* the claim might be misleading, based on the analysis (e.g., explain the logical fallacy used, the danger of anecdotal evidence, how emotional language can manipulate, the importance of source verification). Tailor this to the specific issues identified.
            * **"sources"**: Array of 1-2 strings suggesting specific, reputable websites or organizations where the user can find accurate information or cross-check the claim (e.g., "WHO website for health information", "NASA.gov for space science", "Snopes.com or FactCheck.org for general claims", "Look for peer-reviewed scientific journals"). Be specific and relevant to the query topic.

        User's Text:
        ---
        {user_query}
        ---
        Live Web Search Results:
        ---
        {web_results}
        ---
        Trusted Fact-Check Database Results (Prioritize this):
        ---
        {rag_results}
        ---
        Return ONLY the raw JSON object. Ensure all fields are populated according to these instructions.
        """

        print(f"--- /analyze: Calling {MODEL_ID} (Text) ---")
        response = llm_model.generate_content(
            [prompt],
            generation_config={"response_mime_type": "application/json"}
        )
        print("--- /analyze: Gemini call DONE ---")

        if not response.candidates or not response.candidates[0].content.parts:
             feedback = response.prompt_feedback if hasattr(response, 'prompt_feedback') else 'N/A'
             print(f"!!! /analyze: Gemini response empty/blocked. Feedback: {feedback}")
             error_msg = "AI model response blocked or empty." + (f" Reason: {feedback.block_reason}" if feedback and hasattr(feedback, 'block_reason') else "")
             return jsonify({"error": error_msg}), 500

        response_text = response.text
        print(f"--- /analyze: Received raw JSON response ---")

        try:
            report_data = json.loads(response_text)
            if not all(k in report_data for k in ["score", "analysis", "factors", "learn_more"]):
                raise ValueError("JSON missing required keys (score, analysis, factors, learn_more)")
            if not isinstance(report_data["factors"], list) or len(report_data["factors"]) != 6:
                 raise ValueError("Factors array is invalid (expected 6)")
            
            return jsonify(report_data), 200
        except (json.JSONDecodeError, ValueError) as json_err:
             print(f"!!! /analyze: JSON Parsing/Validation Error - {json_err} !!! Raw text: {response_text}")
             return jsonify({"error": f"AI model returned invalid format: {json_err}", "raw_response": response_text}), 500

    except Exception as e:
        print(f"--- /analyze EXCEPTION HANDLER ---")
        print(f"Error Class: {e.__class__.__name__}, Message: {e}")
        print(traceback.format_exc())
        return jsonify({"error": f"An internal server error occurred: {str(e)}"}), 500

# --- Endpoint 2: Media Analysis (Calls Forensic Service + Gemini) ---
@app.route('/analyze-media', methods=['POST'])
def analyze_media():
    print(f"--- /analyze-media ENTRY (LIVE - {LOCATION} / {MODEL_ID}) ---")
    if init_error: return jsonify({"error": f"AI Service initialization failed: {init_error}"}), 500
    if not llm_model: return jsonify({"error": "AI Service LLM not available."}), 500

    start_time = time.time()
    try:
        if 'file' not in request.files: return jsonify({"error": "No file part"}), 400
        file = request.files['file']
        prompt_text = request.form.get('prompt', '')
        if file.filename == '': return jsonify({"error": "No selected file"}), 400

        file_bytes = file.read()
        mime_type = magic.from_buffer(file_bytes, mime=True)
        print(f"--- /analyze-media: Received '{file.filename}', mime: {mime_type} ---")

        # --- 1. CALL FORENSIC SERVICE ---
        forensic_report_json = {}
        try:
            print(f"--- /analyze-media: Calling Forensic Service at {FORENSIC_SERVICE_URL} ---")
            files_for_forensic = {'file': (file.filename, file_bytes, mime_type)}
            
            response = requests.post(FORENSIC_SERVICE_URL + "/analyze-media-forensics", files=files_for_forensic, timeout=300)
            
            if response.status_code == 200:
                forensic_report_json = response.json()
                print("--- /analyze-media: Forensic report received. ---")
            else:
                print(f"!!! Forensic Service Error: {response.status_code} {response.text}")
                forensic_report_json = {"error": f"Forensic tool failed: {response.status_code}", "details": response.text}
        except Exception as fe:
            print(f"!!! Forensic Service Exception: {fe}")
            forensic_report_json = {"error": f"Forensic tool exception: {str(fe)}"}

        # --- 2. PREPARE PROVENANCE CONTEXT ---
        provenance_info = "C2PA/Provenance check not yet implemented." # Placeholder

        # --- 3. CREATE MEDIA PART FOR GEMINI ---
        media_part = Part.from_data(data=file_bytes, mime_type=mime_type)

        # --- 4. ENHANCED GEMINI PROMPT (9 FACTORS) ---
        prompt_parts = [
            media_part,
            Part.from_text(f"""
            Act as a "Trust Analysis" engine for media. Your task is to perform a deep forensic analysis.
            You MUST synthesize three sources of information:
            1.  Your own **visual analysis** of the media (artifacts, lighting, consistency).
            2.  The **"Provenance Check Context"** (e.g., C2PA data).
            3.  The **"Forensic Report Context"** (which includes metadata, binary structure, and steganography results from our tool).

            Your response MUST be a single, valid JSON object with NO other text before or after it.
            The JSON object must have the exact top-level keys: "score", "analysis", "factors", and "learn_more".

            1.  **"score"**: Integer 0–100. Base this on all evidence. A low score (0-40) indicates strong evidence of manipulation, AI generation, or misleading context. A high score (75-100) indicates strong evidence of authenticity.

            2.  **"analysis"**: Provide a **detailed summary (3-5 sentences)** explaining the reasoning for the score. You MUST explicitly synthesize findings from your visual analysis AND the provided context (e.g., "Visually, the image shows inconsistent shadows. This is corroborated by the 'Forensic Report Context', which notes the file was edited in 'Adobe Photoshop' and the 'Scatter Analysis' indicates non-natural patterns."). **If the Forensic Report indicates a high synthetic likelihood or AI artifacts, state this clearly.**

            3.  **"factors"**: Array of exactly **nine (9)** JSON objects ("label", "value", "sentiment"). 
                Each 'value' must include a concise but detailed explanation (1–2 sentences):
                * "Visual Consistency": (Visual Analysis) Assess lighting, shadows, focus, and perspective.
                * "Object Integrity": (Visual Analysis) Assess the appearance of objects/people (e..g, hands, faces, text).
                * "Contextual Plausibility": (Visual Analysis + User Prompt) Assess if the scene is logical or plausible.
                * "Manipulation Signs": (Visual Analysis) Identify direct indicators of editing (e.g., blurring, pixel mismatch).
                * **"Metadata Analysis"**: (Context) Based *only* on 'Forensic Report' -> 'metadata_exiftool', summarize key findings (e.g., "EXIF data shows file was edited with 'Adobe Photoshop'.", "No metadata (EXIF) found.").
                * **"Binary Structure"**: (Context) Based *only* on 'Forensic Report' -> 'binary_structure_binwalk', state if hidden files were found (e.g., "No embedded files detected.", "High-entropy block found, suggests hidden data.").
                * **"Steganography Check"**: (Context) Based *only* on 'Forensic Report' -> 'steganography_steghide'/'zsteg', state if steganography is likely (e.g., "Steghide check negative.", "Zsteg detected potential hidden data.").
                * **"Provenance Check"**: (Context) Based *only* on 'Provenance Check Context', summarize what was found (e.g., "No C2PA provenance data detected.").
                * "Overall Authenticity": (Combined) A concluding judgment integrating all observations (e.g., "Multiple inconsistencies suggest AI generation.", "Image appears authentic.").
            
            4.  **"learn_more"**: An educational object with keys: "title", "explanation", and "sources".
                * "title": A concise educational heading (e.g., "Spotting AI-Generated Images", "Why Metadata Matters").
                * "explanation": 2–3 sentences educating the user based on *specific issues identified* (e.g., "Stripped metadata is a common tactic to hide a file's origin.").
                * "sources": Array of 1–2 trustworthy resources (e.g., "Google Reverse Image Search", "C2PA.org").

            User's Prompt (if any): '{prompt_text}'
            ---
            **Provenance Check Context:**
            {provenance_info}
            ---
            **Forensic Report Context:**
            {json.dumps(forensic_report_json, indent=2)} 
            ---
            Return ONLY the raw JSON object. Ensure all fields are fully populated.
            """)
        ]

        # --- *** 5. CALL GEMINI & RETURN *** ---
        print(f"--- /analyze-media: Calling {MODEL_ID} (Media) ---")
        response = llm_model.generate_content(
            prompt_parts,
            generation_config={"response_mime_type": "application/json"}
        )
        print("--- /analyze-media: Gemini call DONE ---")

        if not response.candidates or not response.candidates[0].content.parts:
             feedback = response.prompt_feedback if hasattr(response, 'prompt_feedback') else 'N/A'
             print(f"!!! /analyze-media: Gemini response empty/blocked. Feedback: {feedback}")
             error_msg = "AI model response blocked or empty." + (f" Reason: {feedback.block_reason}" if feedback and hasattr(feedback, 'block_reason') else "")
             return jsonify({"error": error_msg}), 500

        response_text = response.text
        print(f"--- /analyze-media: Received raw JSON response ---")

        try:
            report_data = json.loads(response_text)
            # ** VALIDATE FOR 9 FACTORS **
            if not all(k in report_data for k in ["score", "analysis", "factors", "learn_more"]):
                 raise ValueError("JSON missing required keys (score, analysis, factors, learn_more)")
            if not isinstance(report_data["factors"], list) or len(report_data["factors"]) != 9:
                 raise ValueError(f"Factors array is invalid (expected 9, got {len(report_data.get('factors', []))})")
            
            # --- *** 6. ADD REPORTING FEATURE PAYLOAD *** ---
            if report_data.get("score", 100) < 40: # If score is low, add payload
                report_data["report_payload"] = {
                    "type": "misinformation_report",
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "user_query": prompt_text,
                    "file_info": {"name": file.filename, "mime_type": mime_type},
                    "forensic_report": forensic_report_json, # Attach the raw forensic data
                    "ai_analysis": report_data["analysis"]
                }
            # --- *** END REPORTING FEATURE *** ---
            
            processing_time = time.time() - start_time
            print(f"--- /analyze-media: Success. Time: {processing_time:.2f}s ---")
            return jsonify(report_data), 200
        except (json.JSONDecodeError, ValueError) as json_err:
             print(f"!!! /analyze-media: JSON Parsing/Validation Error - {json_err} !!! Raw text: {response_text}")
             return jsonify({"error": f"AI model returned invalid format: {json_err}", "raw_response": response_text}), 500

    except Exception as e:
        processing_time = time.time() - start_time
        print(f"--- /analyze-media EXCEPTION HANDLER. Time: {processing_time:.2f}s ---")
        print(f"Error Class: {e.__class__.__name__}, Message: {e}")
        print(traceback.format_exc())
        error_message = f"Failed to analyze media: {e.__class__.__name__}"
        if "NotFound" in str(e) or "PublisherModel" in str(e):
             error_message = "Configuration Error: AI model access denied."
        return jsonify({"error": error_message, "details": str(e)}), 500

@app.route('/report-misinformation', methods=['POST'])
def report_misinformation():
    """
    Receives the report payload from the frontend.
    For now, just logs it clearly. Replace with actual reporting logic later.
    """
    print("--- /report-misinformation RECEIVED ---")
    try:
        report_data = request.get_json()
        if not report_data:
            return jsonify({"error": "No report data received"}), 400

        # --- *** TODO: Implement Real Reporting Logic *** ---
        # 1. Validate the report_data structure.
        # 2. Format it (e.g., into an email body or structured log).
        # 3. Send it (e.g., using an email library, logging service, or database).

        # For now, just log the received data clearly:
        print("--- MISINFORMATION REPORT PAYLOAD ---")
        print(json.dumps(report_data, indent=2))
        print("------------------------------------")
        # --- *** End TODO *** ---

        return jsonify({"status": "Report received and logged (Demo)"}), 200

    except Exception as e:
        print(f"!!! /report-misinformation ERROR: {e}")
        print(traceback.format_exc())
        return jsonify({"error": f"Failed to process report: {str(e)}"}), 500

# --- HEALTH CHECK Endpoint ---
@app.route("/", methods=["GET"])
def health():
    status = {
        "status": "ok",
        "model_id": MODEL_ID,
        "location": LOCATION,
        "init_error": str(init_error) # Convert error to string for JSON
    }
    return jsonify(status)

# --- Main execution ---
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    print(f"--- Starting Flask Server for Gunicorn on port {port} in {LOCATION} with {MODEL_ID} ---")
    app.run(debug=False, host='0.0.0.0', port=port)
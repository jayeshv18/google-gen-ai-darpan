from flask import Flask, request, jsonify
from flask_cors import CORS
import vertexai
from vertexai.generative_models import GenerativeModel
import json
import os

app = Flask(__name__)

# This allows your local frontend (localhost) to connect to your backend.
CORS(app, resources={r"/analyze": {"origins": "*"}})

# --- Configuration ---
# You might need to set up local authentication for this to run on your PC.
# Run 'gcloud auth application-default login' in your local terminal first.
PROJECT_ID = "darpan-project"
LOCATION = "us-central1"
# ---------------------

vertexai.init(project=PROJECT_ID, location=LOCATION)
model = GenerativeModel("gemini-1.5-pro-001")

@app.route('/analyze', methods=['POST'])
def analyze_content():
    try:
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({"error": "Query not provided"}), 400

        user_query = data['query']

        # The new, more detailed prompt for Gemini to match your professional frontend
        prompt = f"""
        Analyze the following text for misinformation, credibility, and potential manipulation.
        Your primary goal is to act as a "Trust Analysis" engine.
        Based on your analysis, you MUST provide a response in a valid JSON format.
        The JSON object must have the following exact keys: "score", "analysis", and "factors".

        1.  "score": An integer between 0 and 100 representing the trustworthiness of the content. 0 is completely untrustworthy, 100 is highly trustworthy.
        2.  "analysis": A concise, one-paragraph summary explaining your reasoning for the score.
        3.  "factors": An array of exactly six JSON objects. Each object must have three keys: "label", "value", and "sentiment".
            - "label": The name of the factor being analyzed (e.g., "Source Credibility", "Fact-Checking", "Language Analysis", "Bias Detection", "Evidence Quality", "Recency").
            - "value": A short, one-sentence description of your finding for that factor.
            - "sentiment": Your assessment as a single string: "positive", "neutral", or "negative".

        Here is the text to analyze:
        ---
        {user_query}
        ---

        Return ONLY the JSON object, with no other text or markdown formatting.
        """

        response = model.generate_content(prompt)
        
        cleaned_response_text = response.text.strip().replace("```json", "").replace("```", "")
        report_data = json.loads(cleaned_response_text)
        return jsonify(report_data), 200

    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": "Failed to analyze content."}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(debug=True, host='0.0.0.0', port=port)

import vertexai
import json
from vertexai.generative_models import GenerativeModel
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

PROJECT_ID = "darpan-project"
LOCATION = "us-east1" 

vertexai.init(project=PROJECT_ID, location=LOCATION)
gemini_pro_model = GenerativeModel("gemini-1.5-pro")

@app.route('/analyze', methods=['POST'])
def analyze_endpoint():
    data = request.get_json()
    if not data or 'query' not in data:
        return jsonify({"error": "No query provided"}), 400
    
    initial_text = data['query']
    
    # Simplified prompt - Bypasses all other functions
    prompt = f"You are an AI assistant. Respond to the following query: {initial_text}"
    
    try:
        response = gemini_pro_model.generate_content(prompt)
        
        # Create a simple JSON response to match the frontend's expectation
        simple_report = {
          "trustScore": 50,
          "groundTruth": "Analysis based on general knowledge.",
          "intent": "N/A",
          "techniques": [],
          "sources": [],
          "explanation": response.text,
          "similarImages": []
        }
        return jsonify(simple_report)

    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
EOF
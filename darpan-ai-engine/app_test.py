import vertexai
from vertexai.generative_models import GenerativeModel
import os
import traceback

PROJECT_ID = "darpan-project"
LOCATION = "us-central1"
MODEL_ID = "gemini-1.5-flash" # The model we want to use

print("--- Minimal Test Script START ---")
print(f"Using Project: {PROJECT_ID}, Location: {LOCATION}, Model: {MODEL_ID}")

try:
    print("Initializing Vertex AI...")
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    print("Vertex AI Initialized.")

    print(f"Loading model: {MODEL_ID}...")
    model = GenerativeModel(MODEL_ID)
    print("Model Loaded.")

    prompt = "Explain what a large language model is in one sentence."
    print(f"Generating content with prompt: '{prompt}'...")
    response = model.generate_content(prompt)
    print("--- generate_content SUCCEEDED! ---")
    print(f"Response Text: {response.text}")

except Exception as e:
    print(f"--- ERROR OCCURRED ---")
    print(f"Exception Type: {e.__class__.__name__}")
    print(f"Exception Message: {e}")
    print(traceback.format_exc())

print("--- Minimal Test Script END ---")

# Keep Flask app structure for Cloud Run deployment, but it won't be used
from flask import Flask
app = Flask(__name__)
@app.route('/')
def hello_world():
    # This endpoint isn't important for the test
    return 'Minimal test app running. Check logs for Vertex AI call result.'

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(debug=False, host='0.0.0.0', port=port)
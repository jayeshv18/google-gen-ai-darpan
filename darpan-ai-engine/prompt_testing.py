import vertexai
from vertexai.generative_models import GenerativeModel, Part

# --- Your configuration ---
PROJECT_ID = "darpan-project"  # IMPORTANT: Change this
LOCATION = "us-east1"  # Or any other supported location
SERVICE_ACCOUNT_FILE = '/home/jay/Desktop/darpan-ai-engine/darpan-project-210647b5b0f0.json' # IMPORTANT: Change this
# --------------------------

# Initialize Vertex AI
# We no longer need the service account file for this method
# from google.oauth2 import service_account
# credentials = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE)
vertexai.init(project=PROJECT_ID, location=LOCATION)

# Load the models
gemini_flash_model = GenerativeModel("gemini-2.0-flash")
gemini_pro_model = GenerativeModel("gemini-2.0-flash")

print("--- Models Initialized ---")

# --- Deconstruction Prompt Test ---
print("\n--- Testing Deconstruction Prompt (Gemini Flash) ---")
misinformation_text = "Breaking news!! PM said all students get free laptop from govt of india just click on www.bharat-laptop-yojana.in to apply now!! Share with everyone fast!!"

deconstruction_prompt = f"""
Analyze the following text and extract the core factual claims as a JSON list of strings.
Text: "{misinformation_text}"

JSON Output:
"""

response = gemini_flash_model.generate_content(deconstruction_prompt)
print(response.text)


# --- Master "Trust Compass" Prompt Test ---
print('\n--- Testing Master "Trust Compass" Prompt (Gemini Pro) ---')

sample_context = """
[PIB Fact Check Finding: This claim is FAKE. No such scheme has been announced by the Government of India. The link provided is a scam. Citizens are advised not to click on such links.]
[Tech News Analysis Article: Phishing scams related to free electronics are common. Scammers create fake websites to trick users into entering sensitive personal information. Telltale signs include a sense of urgency and URLs that are not from the official 'gov.in' domain.]
"""

master_prompt = f"""
You are Arivu, a world-class misinformation analyst. Your task is to analyze a user's query based ONLY on the trusted context provided.
Generate a report in the exact JSON schema required for the 'trustCompass' object.

[Trusted Context]:
{sample_context}

[User's Query]:
{misinformation_text}

[JSON Report Body for 'trustCompass' object]:
"""

response = gemini_pro_model.generate_content(master_prompt)
print(response.text)

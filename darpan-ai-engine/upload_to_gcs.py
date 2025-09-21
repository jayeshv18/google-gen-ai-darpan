import os
from google.cloud import storage

# --- Your configuration ---
SERVICE_ACCOUNT_FILE = '/home/jay/Desktop/darpan-ai-engine/darpan-project-210647b5b0f0.json' # IMPORTANT: Change this
BUCKET_NAME = 'darpan-project-corpus-001' # IMPORTANT: Change this to a globally unique name
CORPUS_DIRECTORY = 'corpus'
# --------------------------

# Authenticate
storage_client = storage.Client.from_service_account_json(SERVICE_ACCOUNT_FILE)

# Create the bucket (if it doesn't exist)
try:
    bucket = storage_client.create_bucket(BUCKET_NAME)
    print(f"Bucket {BUCKET_NAME} created.")
except Exception as e:
    print(f"Bucket {BUCKET_NAME} likely already exists. Error: {e}")
    bucket = storage_client.get_bucket(BUCKET_NAME)

# Upload files
for filename in os.listdir(CORPUS_DIRECTORY):
    if filename.endswith('.txt'):
        filepath = os.path.join(CORPUS_DIRECTORY, filename)
        blob = bucket.blob(filename)
        blob.upload_from_filename(filepath)
        print(f"Uploaded {filename} to bucket {BUCKET_NAME}.")

print("\nUpload complete.")

# Use the official Python 3.11 slim image.
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED True
ENV APP_HOME /app
WORKDIR $APP_HOME

# Install system dependencies (like libmagic) first
RUN apt-get update && apt-get install -y --no-install-recommends libmagic1 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy requirements file and install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt -U # Run pip install ONCE

# --- Download NLTK and TextBlob data during build ---
# This needs to run AFTER pip install
RUN python -m nltk.downloader punkt stopwords
RUN python -m textblob.download_corpora lite
# --- END NEW ---

# Copy the rest of the application code into the container
# This should be one of the LAST steps
COPY . .

# Use Gunicorn as the entry point
# Correct Gunicorn command for Cloud Run $PORT variable
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app
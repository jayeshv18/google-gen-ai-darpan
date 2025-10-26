FROM python:3.11-slim
ENV PYTHONUNBUFFERED True
ENV APP_HOME /app
WORKDIR $APP_HOME
COPY requirements.txt ./
# Make sure libmagic1 is here
RUN apt-get update && apt-get install -y --no-install-recommends libmagic1 && \
    pip install --no-cache-dir -r requirements.txt && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
COPY . ./
# Correct Gunicorn command for Cloud Run $PORT variable
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app
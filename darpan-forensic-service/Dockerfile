# Use the full Python 3.11 image, not -slim
FROM python:3.11

# Install native dependencies for forensic tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    exiftool \
    binwalk \
    steghide \
    libmagic1 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install Python packages (using the clean requirements.txt)
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application's source code
COPY . .

# Define environment variable for the PORT
ENV PORT 8080

# --- *** CORRECTED CMD LINE *** ---
# This line runs Gunicorn to serve your FastAPI (main:app)
CMD exec gunicorn --workers 1 --threads 8 --timeout 0 -k uvicorn.workers.UvicornWorker --bind :$PORT main:app
# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install build tools needed for some packages
RUN apt-get update && apt-get install -y gcc build-essential pkg-config libdbus-1-dev libglib2.0-dev libcairo2-dev libgirepository1.0-dev

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application's code
COPY . .

# Run app.py when the container launches
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:8080", "app:app"]
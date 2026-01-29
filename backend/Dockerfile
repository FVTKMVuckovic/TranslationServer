FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Azure Speech SDK
# Azure Speech SDK requires specific libraries to work in containers
RUN apt-get update && apt-get install -y \
    build-essential \
    libssl-dev \
    libssl3 \
    ca-certificates \
    libasound2 \
    libasound2-dev \
    libgstreamer1.0-0 \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    libglib2.0-0 \
    libstdc++6 \
    libgomp1 \
    libatomic1 \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Run with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

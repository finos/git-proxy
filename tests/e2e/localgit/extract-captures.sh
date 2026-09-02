#!/bin/bash
# Helper script to extract captured git data from the Docker container
# Usage: ./extract-captures.sh [output-dir]

set -e

SERVICE_NAME="git-server"
CAPTURE_DIR="/var/git-captures"
OUTPUT_DIR="${1:-./captured-data}"

echo "Extracting captured git data from service: $SERVICE_NAME"
echo "Output directory: $OUTPUT_DIR"

# Check if service is running
if ! docker compose ps --status running "$SERVICE_NAME" | grep -q "$SERVICE_NAME"; then
    echo "Error: Service $SERVICE_NAME is not running"
    echo "Available services:"
    docker compose ps
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if there are any captures
CAPTURE_COUNT=$(docker compose exec -T "$SERVICE_NAME" sh -c "ls -1 $CAPTURE_DIR/*.bin 2>/dev/null | wc -l" || echo "0")

if [ "$CAPTURE_COUNT" -eq "0" ]; then
    echo "No captures found in container"
    echo "Try performing a git push operation first"
    exit 0
fi

echo "Found captures, copying to $OUTPUT_DIR..."

# Copy all captured files using docker compose
CONTAINER_ID=$(docker compose ps -q "$SERVICE_NAME")
docker cp "$CONTAINER_ID:$CAPTURE_DIR/." "$OUTPUT_DIR/"

echo "Extraction complete!"
echo ""
echo "Files extracted to: $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR"

echo ""
echo "Capture groups (by timestamp):"
for metadata in "$OUTPUT_DIR"/*.metadata.txt; do
    if [ -f "$metadata" ]; then
        echo "---"
        grep -E "^(Timestamp|Service|Request File|Response File|Request Body Size|Response Size):" "$metadata"
    fi
done

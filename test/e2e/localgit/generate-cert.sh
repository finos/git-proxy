#!/bin/bash
# Generate self-signed certificate for the git server
# This script is run during Docker build to create SSL certificates

set -e

CERT_DIR="/usr/local/apache2/conf/ssl"
mkdir -p "$CERT_DIR"

# Generate private key and self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -subj "/C=US/ST=Test/L=Test/O=GitProxy/OU=E2E/CN=git-server" \
    -addext "subjectAltName=DNS:git-server,DNS:localhost,IP:127.0.0.1"

# Set proper permissions
chmod 600 "$CERT_DIR/server.key"
chmod 644 "$CERT_DIR/server.crt"

echo "SSL certificate generated successfully"

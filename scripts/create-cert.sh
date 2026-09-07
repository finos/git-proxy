#!/usr/bin/env bash
set -euo pipefail

# Generates a self-signed certificate for GitProxy HTTPS (tls.key / tls.cert).
# The certificate expires in 10 years. TLS is disabled by default; enable it in
# proxy.config.json after running this script.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/certs"

openssl req -x509 -newkey rsa:4096 \
  -keyout "$ROOT/certs/key.pem" \
  -out "$ROOT/certs/cert.pem" \
  -sha256 -days 3650 -nodes \
  -subj "/C=US/ST=NY/L=New York/O=FINOS/OU=CTI/CN=localhost"

echo "Wrote $ROOT/certs/key.pem and $ROOT/certs/cert.pem"

#!/bin/bash
# Use runtime environment variables (not VITE_* which are build-time only)
# API_URL can be set at runtime to override auto-detection
# ALLOWED_ORIGINS can be set at runtime for CORS configuration
cat > /app/dist/build/runtime-config.json << EOF
{
  "apiUrl": "${API_URL:-}",
  "allowedOrigins": [
    "${ALLOWED_ORIGINS:-*}"
  ],
  "environment": "${NODE_ENV:-production}"
}
EOF

echo "Created runtime configuration with:"
echo "  API URL: ${API_URL:-auto-detect}"
echo "  Allowed Origins: ${ALLOWED_ORIGINS:-*}"
echo "  Environment: ${NODE_ENV:-production}"

exec "$@"

#!/bin/bash

# Create runtime configuration file for the UI
# This allows the UI to discover its environment dynamically
cat > /app/dist/runtime-config.json << EOF
{
  "apiUrl": "${VITE_API_URI:-}",
  "allowedOrigins": [
    "${VITE_ALLOWED_ORIGINS:-*}"
  ],
  "environment": "${NODE_ENV:-production}"
}
EOF

echo "Created runtime configuration with:"
echo "  API URL: ${VITE_API_URI:-auto-detect}"
echo "  Allowed Origins: ${VITE_ALLOWED_ORIGINS:-*}"

exec "$@"

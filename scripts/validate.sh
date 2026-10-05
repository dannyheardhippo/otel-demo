#!/usr/bin/env bash
# Validate an otel-collector-contrib config without starting anything real.
# Usage: ./scripts/validate.sh collector/config.yaml
set -euo pipefail

FILE="${1:?usage: validate.sh <path-to-config.yaml>}"
# Keep in sync with collector/Dockerfile's base image tag.
TAG="0.162.0-arm64"

if [[ ! -f "$FILE" ]]; then
  echo "error: $FILE does not exist" >&2
  exit 1
fi

ABS_DIR="$(cd "$(dirname "$FILE")" && pwd)"
BASENAME="$(basename "$FILE")"

docker run --rm \
  -v "${ABS_DIR}:/cfg:ro" \
  "otel/opentelemetry-collector-contrib:${TAG}" \
  validate --config "/cfg/${BASENAME}"

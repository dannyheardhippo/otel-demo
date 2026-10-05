#!/usr/bin/env bash
# Switch the live collector config to one of the numbered demo scenarios.
# Usage: ./scripts/scenario.sh 03
set -euo pipefail

cd "$(dirname "$0")/.."

NUM="${1:?usage: scenario.sh <NN>  (e.g. scenario.sh 03)}"
MATCH=(collector/scenarios/"${NUM}"-*.yaml)

if [[ ! -e "${MATCH[0]}" ]]; then
  echo "error: no scenario matching '${NUM}' in collector/scenarios/" >&2
  echo "available scenarios:" >&2
  ls collector/scenarios >&2
  exit 1
fi

SRC="${MATCH[0]}"
echo "==> Validating ${SRC}"
./scripts/validate.sh "${SRC}"

echo "==> Diff against current collector/config.yaml"
diff -u collector/config.yaml "${SRC}" && echo "(no changes)" || true

cp "${SRC}" collector/config.yaml
echo "==> Applied ${SRC} -> collector/config.yaml"
echo "    docker compose watch will sync + restart the collector automatically."

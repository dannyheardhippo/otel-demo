#!/bin/sh
# Background traffic for the demo: hits the API at ~RPS requests/second with
# a realistic-ish mix. Runs in the curlimages/curl image - no build, no deps.
# Uses awk for randomness since this image's /bin/sh (ash) has no $RANDOM.
set -eu

BASE="${TARGET:-http://api:3000}/api"
RPS="${RPS:-2}"
SLEEP=$(awk "BEGIN { print 1 / $RPS }")
CARD="4111111111111111"

# busybox awk's srand() with no seed uses the current time, which is good
# enough for generating varied demo traffic.
rand_below() { awk -v n="$1" 'BEGIN { srand(); print int(rand() * n) }'; }

echo "[loadgen] targeting $BASE at ~$RPS req/s"

while true; do
  roll=$(rand_below 100)
  if [ "$roll" -lt 50 ]; then
    curl -s -o /dev/null "$BASE/products"
  elif [ "$roll" -lt 75 ]; then
    productId=$(( $(rand_below 12) + 1 ))
    customerId=$(( $(rand_below 5) + 1 ))
    curl -s -o /dev/null -X POST "$BASE/orders" \
      -H 'Content-Type: application/json' \
      -d "{\"customerId\":$customerId,\"items\":[{\"productId\":$productId,\"qty\":1}],\"cardNumber\":\"$CARD\"}"
  elif [ "$roll" -lt 85 ]; then
    customerId=$(( $(rand_below 5) + 1 ))
    curl -s -o /dev/null "$BASE/orders?customerId=$customerId"
  elif [ "$roll" -lt 95 ]; then
    curl -s -o /dev/null "$BASE/chaos/random"
  else
    curl -s -o /dev/null "$BASE/health"
  fi
  sleep "$SLEEP"
done

#!/usr/bin/env bash
set -euo pipefail

workspace_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
audio_file="${workspace_dir}/server/testdata/logue-e2e.wav"
api_base="http://127.0.0.1:8787"
request_id="e2e-audio-fixture-v1"
expected="Logue keeps every source and preserves the relationship between original notes and derived insights."

if [[ ! -f "${audio_file}" ]]; then
  echo "Missing fixture: ${audio_file}" >&2
  exit 1
fi

existing="$(curl --fail --silent --show-error "${api_base}/v1/items" | jq -c --arg request_id "${request_id}" '.items[] | select(.request_id == $request_id)' | head -n 1)"
if [[ -n "${existing}" ]]; then
  transcript="$(jq -r '.transcript' <<<"${existing}")"
  [[ "${transcript}" == "${expected}" ]] || { echo "Existing E2E material has unexpected transcript: ${transcript}" >&2; exit 1; }
  jq -n --arg status "verified-existing" --argjson material "${existing}" '{status:$status,material:$material}'
  exit 0
fi

transcription="$(curl --fail --silent --show-error \
  -F "audio=@${audio_file};type=audio/wav" \
  -F "page_url=https://example.com/design-notes" \
  -F "page_title=Logue design notes" \
  -F "selected_text=The original source must remain immutable." \
  -F "instructions=Return a faithful English transcription." \
  "${api_base}/v1/transcribe")"

transcript="$(jq -r '.text' <<<"${transcription}")"
capture_id="$(jq -r '.capture_id' <<<"${transcription}")"
[[ "${transcript}" == "${expected}" ]] || { echo "Unexpected transcript: ${transcript}" >&2; exit 1; }

material="$(jq -n \
  --arg request_id "${request_id}" \
  --arg content "${transcript}" \
  --arg capture_id "${capture_id}" \
  '{request_id:$request_id,kind:"voice",content:$content,transcript:$content,capture_id:$capture_id,projects:["Vibedoc 对齐"],tags:["e2e","transcription"],source:{url:"https://example.com/design-notes",title:"Logue design notes",domain:"example.com"}}' \
  | curl --fail --silent --show-error -X POST "${api_base}/v1/items" -H 'Content-Type: application/json' --data-binary @-)"

jq -n --arg status "verified-and-saved" --argjson material "${material}" '{status:$status,material:$material}'

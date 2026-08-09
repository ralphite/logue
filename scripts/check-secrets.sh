#!/usr/bin/env bash
#
# Refuse to let a secret, or somebody's workspace, reach a commit.
#
# This exists because both already happened. A commit whose subject was about
# shadow-DOM stacking carried 455 other files with it — a workspace backup
# named `.logue-data.before-rebuild-<n>/`, which `.gitignore` did not match by
# one character, with the Gemini API key inside it. It went to a public
# repository and Google revoked the key.
#
# `git add -A` is how it happened, and `git add -A` is not going away: it is
# the right command almost every time. So the check lives here instead, where
# it does not depend on anyone remembering.
#
# (And this file itself was lost once before it was ever committed — written,
# wired in, then wiped by a filter-repo hard reset minutes later. A guard that
# exists only in the working tree guards nothing.)
set -Eeuo pipefail

staged="$(git diff --cached --name-only --diff-filter=ACM)"
[ -z "${staged}" ] && exit 0

fail=0
say() { printf '%s\n' "$*" >&2; fail=1; }

# -- 1. Files that are nobody's business but the person using this ------------
while IFS= read -r path; do
  case "${path}" in
    .logue-data*/*|*/.logue-data*/*)
      say "refusing: ${path} — a workspace is someone's own recordings, not source" ;;
    *ai-provider.json|*/settings.json)
      say "refusing: ${path} — this is where the API key lives" ;;
    *.env|*/.env)
      say "refusing: ${path} — use .env.example, with no values in it" ;;
  esac
done <<< "${staged}"

# -- 2. Anything key-shaped, wherever it is -----------------------------------
#
# By shape, not by filename: the last one was in a file nobody would have
# thought to look in. This script excludes itself so its own patterns do not
# trip the check.
patterns='AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9]{32,}|ghp_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{10,}'
if git diff --cached -U0 -- . ':(exclude)scripts/check-secrets.sh' | grep -qE "^\+.*(${patterns})"; then
  say "refusing: something shaped like an API key is in this diff"
  git diff --cached -U0 --name-only -- . ':(exclude)scripts/check-secrets.sh' \
    | while IFS= read -r path; do
        if git diff --cached -U0 -- "${path}" | grep -qE "^\+.*(${patterns})"; then
          say "           in ${path}"
        fi
      done
fi

# -- 3. A commit that quietly grew ---------------------------------------------
#
# Not a rule about size — some commits are genuinely large. It is a rule about
# noticing: past this many files, say so out loud and let a person agree.
count="$(printf '%s\n' "${staged}" | wc -l | tr -d ' ')"
if [ "${count}" -gt 120 ] && [ "${LOGUE_BULK_OK:-}" != "1" ]; then
  say "refusing: ${count} files in one commit."
  say "           Read the list. If it is meant, run again with LOGUE_BULK_OK=1."
fi

if [ "${fail}" -ne 0 ]; then
  printf '\n%s\n' "Nothing was committed." >&2
  exit 1
fi

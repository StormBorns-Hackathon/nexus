#!/usr/bin/env bash
# todo-scanner.sh — place at repo root
# Deps: curl, grep, md5sum (all pre-installed on ubuntu-latest)

set -uo pipefail   # removed -e; we handle errors explicitly

LABEL="${TODO_LABEL:-todo}"
AUTO_CLOSE="${AUTO_CLOSE:-true}"
OWNER="${GITHUB_REPOSITORY%%/*}"
REPO="${GITHUB_REPOSITORY##*/}"
API="https://api.github.com"

IGNORE_DIRS="node_modules .git dist build .next coverage"
INCLUDES=(--include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx")
EXCLUDES=()
for d in $IGNORE_DIRS; do EXCLUDES+=(--exclude-dir="$d"); done

# ── Helpers ───────────────────────────────────────────────────────────────────

gh_api() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -X "$method"
    -H "Authorization: Bearer $GITHUB_TOKEN"
    -H "Accept: application/vnd.github+json"
    -H "X-GitHub-Api-Version: 2022-11-28"
    -H "Content-Type: application/json")
  [[ -n "$body" ]] && args+=(-d "$body")
  curl "${args[@]}" "${API}${path}"
}

make_fp() { printf '%s' "$1" | md5sum | cut -c1-8; }

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/' | tr -d '\n' | sed 's/\\n$//'
}

# ── Ensure label exists ───────────────────────────────────────────────────────

ensure_label() {
  local status
  status=$(curl -sS -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "${API}/repos/${OWNER}/${REPO}/labels/${LABEL}")
  if [[ "$status" == "404" ]]; then
    gh_api POST "/repos/${OWNER}/${REPO}/labels" \
      "{\"name\":\"${LABEL}\",\"color\":\"e4e669\",\"description\":\"Auto-created from TODO comments\"}" \
      > /dev/null
    echo "✅  Created label \"${LABEL}\""
  else
    echo "✅  Label \"${LABEL}\" already exists"
  fi
}

# ── Fetch ALL todo issues into a temp file (one shot, no per-issue calls) ─────

ISSUES_FILE=$(mktemp)
ACTIVE_FP_FILE=$(mktemp)
trap 'rm -f "$ISSUES_FILE" "$ACTIVE_FP_FILE"' EXIT

fetch_todo_issues() {
  local page=1
  while true; do
    local batch
    batch=$(gh_api GET \
      "/repos/${OWNER}/${REPO}/issues?labels=${LABEL}&state=all&per_page=100&page=${page}")
    printf '%s' "$batch" >> "$ISSUES_FILE"
    # grep returns 1 if no match — use || true so pipefail doesn't kill us
    local count
    count=$(printf '%s' "$batch" | grep -c '"number"' || true)
    [[ "$count" -lt 100 ]] && break
    (( page++ )) || true   # (( )) exits 1 when expression == 0; guard with || true
  done
  echo "🗂   Fetched existing TODO issues from GitHub"
}

# Given a fingerprint, return the issue number + state if it exists
# Format of ISSUES_FILE is raw concatenated JSON arrays — we parse with grep+sed
find_issue_for_fp() {
  local fp="$1"
  # Find the fingerprint marker in the flat JSON dump
  # The body field contains our marker as: todo-fingerprint:XXXXXXXX
  grep -o "todo-fingerprint:${fp}" "$ISSUES_FILE" > /dev/null 2>&1 || return 1

  # Extract all issue objects that contain this fingerprint.
  # We search for "number":NNN near our fingerprint string.
  # This is a rough but reliable grep on the flat JSON.
  grep -o '"number":[0-9]*' "$ISSUES_FILE" | grep -o '[0-9]*' | while read -r num; do
    local detail
    detail=$(gh_api GET "/repos/${OWNER}/${REPO}/issues/${num}")
    if printf '%s' "$detail" | grep -q "todo-fingerprint:${fp}"; then
      local state
      state=$(printf '%s' "$detail" | grep -o '"state":"[^"]*"' | head -1 | cut -d'"' -f4)
      printf '%s %s' "$num" "$state"
      return 0
    fi
  done | head -1
}

# ── Scan source files for TODOs ───────────────────────────────────────────────

scan_todos() {
  # grep exits 1 if no matches — that's fine, just means no TODOs
  grep -rn --ignore-case \
    "${EXCLUDES[@]}" \
    "${INCLUDES[@]}" \
    -E '//\s*TODO(\([^)]+\))?:?\s*.+' \
    . 2>/dev/null || true
}

# ── Main ──────────────────────────────────────────────────────────────────────

echo "🔍  Scanning for TODOs…"
ensure_label
fetch_todo_issues

created=0; reopened=0; skipped=0; closed=0

while IFS= read -r grep_line; do
  [[ -z "$grep_line" ]] && continue

  # Parse  ./path/file.ts:42:  // TODO(author): message
  rel_path=$(printf '%s' "$grep_line" | cut -d: -f1 | sed 's|^\./||')
  line_num=$(printf '%s' "$grep_line"  | cut -d: -f2)
  raw_text=$(printf '%s' "$grep_line"  | cut -d: -f3-)

  # Extract optional author and message
  author=$(printf '%s' "$raw_text" | grep -oP '(?<=TODO\()[^)]+(?=\))' || true)
  message=$(printf '%s' "$raw_text" \
    | sed -E 's|.*//\s*[Tt][Oo][Dd][Oo](\([^)]+\))?:?\s*||' \
    | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

  [[ -z "$message" ]] && continue

  fp=$(make_fp "${rel_path}:${message}")
  echo "$fp" >> "$ACTIVE_FP_FILE"

  author_prefix=""
  [[ -n "$author" ]] && author_prefix="[${author}] "
  title="TODO: ${author_prefix}${message}"
  title="${title:0:120}"

  esc_msg=$(json_escape "$message")
  esc_file=$(json_escape "$rel_path")
  author_line=""
  [[ -n "$author" ]] && author_line="\\n**Author hint:** \`${author}\`"

  body="### 📌 TODO in \`${esc_file}:${line_num}\`\\n\\n> ${esc_msg}\\n\\n**File:** \`${esc_file}:${line_num}\`${author_line}\\n\\n---\\n_Auto-created by TODO Scanner._\\n<!-- todo-fingerprint:${fp} -->"

  # Check if issue already exists for this fingerprint
  if grep -q "todo-fingerprint:${fp}" "$ISSUES_FILE" 2>/dev/null; then
    # Find the issue number by fetching the list one more time scoped to fewer items
    issue_info=$(find_issue_for_fp "$fp")
    issue_num=$(printf '%s' "$issue_info" | cut -d' ' -f1)
    issue_state=$(printf '%s' "$issue_info" | cut -d' ' -f2)

    if [[ "$issue_state" == "closed" ]]; then
      gh_api PATCH "/repos/${OWNER}/${REPO}/issues/${issue_num}" \
        "{\"state\":\"open\",\"body\":\"${body}\"}" > /dev/null
      echo "  🔄  Reopened #${issue_num} — ${rel_path}:${line_num}"
      (( reopened++ )) || true
    else
      echo "  ✓   Exists   #${issue_num} — ${rel_path}:${line_num}"
      (( skipped++ )) || true
    fi
  else
    # New TODO — create issue
    # Build assignees array if author was specified
    assignees_json=""
    if [[ -n "$author" ]]; then
      clean_author="${author#@}"   # strip leading @ if present
      assignees_json=",\"assignees\":[\"${clean_author}\"]"
    fi

    payload="{\"title\":\"$(json_escape "$title")\",\"body\":\"${body}\",\"labels\":[\"${LABEL}\"]${assignees_json}}"
    result=$(gh_api POST "/repos/${OWNER}/${REPO}/issues" "$payload")
    issue_num=$(printf '%s' "$result" | grep -o '"number":[0-9]*' | grep -o '[0-9]*' | head -1)
    echo "  ✨  Created  #${issue_num} — ${rel_path}:${line_num}"
    (( created++ )) || true
  fi

done < <(scan_todos)

# ── Auto-close issues whose TODO was removed ──────────────────────────────────

if [[ "$AUTO_CLOSE" == "true" ]]; then
  echo ""
  echo "🔒  Checking for removed TODOs…"

  open_issues=$(gh_api GET \
    "/repos/${OWNER}/${REPO}/issues?labels=${LABEL}&state=open&per_page=100")

  # For each open issue, check if its fingerprint is still active
  while IFS= read -r num; do
    [[ -z "$num" ]] && continue
    issue_detail=$(gh_api GET "/repos/${OWNER}/${REPO}/issues/${num}")
    fp=$(printf '%s' "$issue_detail" | grep -oE 'todo-fingerprint:[a-f0-9]{8}' \
      | cut -d: -f2 | head -1 || true)
    [[ -z "$fp" ]] && continue

    if ! grep -qxF "$fp" "$ACTIVE_FP_FILE" 2>/dev/null; then
      gh_api PATCH "/repos/${OWNER}/${REPO}/issues/${num}" \
        '{"state":"closed"}' > /dev/null
      gh_api POST "/repos/${OWNER}/${REPO}/issues/${num}/comments" \
        '{"body":"🎉 The TODO comment was removed from source. Auto-closing."}' > /dev/null
      echo "  🔒  Closed   #${num} — TODO removed from source"
      (( closed++ )) || true
    fi
  done < <(printf '%s' "$open_issues" | grep -o '"number":[0-9]*' | grep -o '[0-9]*' || true)
fi

echo ""
echo "✅  Done — created: ${created}, reopened: ${reopened}, skipped: ${skipped}, closed: ${closed}"

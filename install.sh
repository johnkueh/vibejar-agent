#!/usr/bin/env bash
# vibejar installer — CLI + Agent Skill (agentskills.io)
# One-shot, idempotent, safe for agents and humans.
#
#   curl -fsSL https://vibejar.com/install.sh | bash
#   curl -fsSL https://vibejar.com/install.sh | bash -s -- --update
#
# Installs:
#   ~/.vibejar/cli.ts
#   ~/.agents/skills/vibejar/SKILL.md   (canonical Agent Skills path)
#   symlinks into Claude / Grok / Codex skill dirs when present
#
set -euo pipefail

BASE_URL="${VIBEJAR_BASE_URL:-https://vibejar.com}"
SOURCE_DIR="${VIBEJAR_SOURCE_DIR:-}"
HOME_DIR="${HOME:-$(eval echo ~)}"
VIBEJAR_DIR="${HOME_DIR}/.vibejar"
AGENTS_SKILL_DIR="${HOME_DIR}/.agents/skills/vibejar"
CLI_PATH="${VIBEJAR_DIR}/cli.ts"
SKILL_PATH="${AGENTS_SKILL_DIR}/SKILL.md"
STAMP_PATH="${VIBEJAR_DIR}/install.json"

UPDATE=0
for arg in "$@"; do
  case "$arg" in
    --update|-u) UPDATE=1 ;;
    --help|-h)
      echo "Usage: install.sh [--update]"
      echo "  Installs vibejar CLI + skill. --update forces re-download."
      exit 0
      ;;
  esac
done

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "error: need '$1' on PATH" >&2
    exit 1
  }
}

need_cmd mkdir
need_cmd ln
need_cmd cp
[ -n "${SOURCE_DIR}" ] || need_cmd curl

install_file() {
  local source_path="$1"
  local remote_path="$2"
  local destination="$3"

  if [ -n "${SOURCE_DIR}" ]; then
    if [ ! -f "${SOURCE_DIR}/${source_path}" ]; then
      echo "error: missing ${SOURCE_DIR}/${source_path}" >&2
      exit 1
    fi
    cp "${SOURCE_DIR}/${source_path}" "${destination}.tmp"
  else
    curl -fsSL "${BASE_URL}/${remote_path}" -o "${destination}.tmp"
  fi
  mv "${destination}.tmp" "${destination}"
}

if ! command -v bun >/dev/null 2>&1; then
  echo "note: bun not found — installing bun (https://bun.sh)…"
  curl -fsSL https://bun.sh/install | bash
  # shellcheck disable=SC1090
  [ -f "${HOME_DIR}/.bun/bin/bun" ] && export PATH="${HOME_DIR}/.bun/bin:$PATH"
  need_cmd bun
fi

mkdir -p "${VIBEJAR_DIR}" "${AGENTS_SKILL_DIR}"

echo "→ CLI  ${CLI_PATH}"
install_file "cli.ts" "cli.ts" "${CLI_PATH}"

# Bun resolves @instantdb/core + fake-indexeddb from this package.json
# (the CLI is one file but not zero-deps — keep deps pinned next to it).
cat > "${VIBEJAR_DIR}/package.json" <<'PKG'
{
  "name": "vibejar-cli",
  "private": true,
  "type": "module",
  "dependencies": {
    "@instantdb/core": "^1.0.49",
    "fake-indexeddb": "^6.0.0"
  }
}
PKG
echo "→ deps  ${VIBEJAR_DIR}/package.json"
(
  cd "${VIBEJAR_DIR}"
  bun install --no-save 2>/dev/null || bun install
)

echo "→ skill ${SKILL_PATH}"
install_file "skill/SKILL.md" "skill/SKILL.md" "${SKILL_PATH}"

# Canonical skill dir is already AGENTS_SKILL_DIR (~/.agents/skills/vibejar).
# Symlink that directory into agent-specific skill trees (never self-link).
link_skill() {
  local target_parent="$1"
  local link_path="${target_parent}/vibejar"
  # Skip if this IS the canonical parent
  if [ "$(cd "${target_parent}" 2>/dev/null && pwd -P)" = "$(cd "${HOME_DIR}/.agents/skills" 2>/dev/null && pwd -P)" ]; then
    return 0
  fi
  mkdir -p "${target_parent}"
  if [ -L "${link_path}" ]; then
    ln -sfn "${AGENTS_SKILL_DIR}" "${link_path}"
    echo "→ link  ${link_path} → ${AGENTS_SKILL_DIR}"
  elif [ ! -e "${link_path}" ]; then
    ln -sfn "${AGENTS_SKILL_DIR}" "${link_path}"
    echo "→ link  ${link_path} → ${AGENTS_SKILL_DIR}"
  elif [ -d "${link_path}" ]; then
    cp "${SKILL_PATH}" "${link_path}/SKILL.md"
    echo "→ copy  ${link_path}/SKILL.md (existing dir)"
  fi
}

# Product-specific hosts (agentskills.io path is already installed above)
[ -d "${HOME_DIR}/.claude" ] && link_skill "${HOME_DIR}/.claude/skills"
[ -d "${HOME_DIR}/.grok" ] && link_skill "${HOME_DIR}/.grok/skills"
[ -d "${HOME_DIR}/.codex" ] && link_skill "${HOME_DIR}/.codex/skills"
[ -d "${HOME_DIR}/.cursor" ] && link_skill "${HOME_DIR}/.cursor/skills"

# Stamp for self-update freshness checks
NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u)"
CLI_SHA="$(
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "${CLI_PATH}" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then sha256sum "${CLI_PATH}" | awk '{print $1}'
  else echo "unknown"
  fi
)"
SKILL_SHA="$(
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "${SKILL_PATH}" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then sha256sum "${SKILL_PATH}" | awk '{print $1}'
  else echo "unknown"
  fi
)"
cat > "${STAMP_PATH}" <<EOF
{
  "installedAt": "${NOW}",
  "baseUrl": "${BASE_URL}",
  "cliPath": "${CLI_PATH}",
  "skillPath": "${SKILL_PATH}",
  "cliSha256": "${CLI_SHA}",
  "skillSha256": "${SKILL_SHA}"
}
EOF

echo
echo "installed."
echo "  CLI:   bun ${CLI_PATH} whoami"
echo "  skill: ${SKILL_PATH}"
echo "  update: bun ${CLI_PATH} self-update"
echo
echo "Pair with the phone app to access its jars:"
echo "  bun ${CLI_PATH} pair <token> --name \"This coding agent\""
echo
# Soft verify
if bun "${CLI_PATH}" whoami >/dev/null 2>&1; then
  bun "${CLI_PATH}" whoami
else
  echo "identity: not paired yet (fork a jar or pair a token)"
fi

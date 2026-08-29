#!/usr/bin/env bash
# ------------------------------------------------------------------
# start-trueforge.sh
# Patches TrueForge sandbox + launches the standalone server
# with proxy env vars cleared so pip can reach PyPI directly.
# ------------------------------------------------------------------
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

# 1. Patch TrueForge's ensureVenv so pip unsets proxy vars before install
if [ -f "$DIR/patch-trueforge.js" ]; then
  echo "🔧 Patching TrueForge sandbox pip proxy..."
  node "$DIR/patch-trueforge.js" || true
fi

# 2. Strip every proxy-related variable so child processes
#    (including pip inside the local sandbox venv) never inherit a broken proxy.
unset HTTP_PROXY  http_proxy
unset HTTPS_PROXY https_proxy
unset ALL_PROXY    all_proxy
unset FTP_PROXY    ftp_proxy
unset NO_PROXY     no_proxy

# 3. Belt-and-suspenders: force empty proxy in pip config
PIP_CONF_DIR="${HOME}/.config/pip"
mkdir -p "$PIP_CONF_DIR"
cat > "${PIP_CONF_DIR}/pip.conf" <<'PIPCONF'
[global]
proxy =
PIPCONF

# 4. Use custom model catalog (Gemini 3.1 & 3.5 Flash Lite only)
CATALOG="$(cd "$(dirname "$0")" && pwd)/../../model-catalog.yaml"
if [ -f "$CATALOG" ]; then
  export MODEL_CATALOG_PATH="$CATALOG"
  echo "📦 Using custom model catalog: $CATALOG"
else
  echo "⚠️  Custom model catalog not found at $CATALOG — using shipped catalog"
fi

# 5. Launch TrueForge with logging
LOGFILE="${HOME}/.local/share/trueforge/trueforge.log"
mkdir -p "$(dirname "$LOGFILE")"
> "$LOGFILE"
echo "🚀 Starting TrueForge (proxy cleared) | log: $LOGFILE"
npx @truefoundry/trueforge@latest "$@" 2>&1 | tee -a "$LOGFILE"

#!/usr/bin/env bash
set -euo pipefail

# ─── Mythic Wallet Extension — Release Script ───
# Usage: ./scripts/release.sh [patch|minor|major]
#   patch: 1.0.0 → 1.0.1 (default)
#   minor: 1.0.0 → 1.1.0
#   major: 1.0.0 → 2.0.0

BUMP="${1:-patch}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WALLET_SITE="${ROOT}/../mythic-wallet-site"
DIST="${ROOT}/dist"
CRX_KEY="${ROOT}/mythic-wallet.pem"

# ─── 1. Version bump ───

CURRENT=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "1.0.0")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *) echo "Usage: $0 [patch|minor|major]"; exit 1 ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
echo "==> Bumping version: ${CURRENT} → ${NEW_VERSION}"

# Update package.json
cd "$ROOT"
npm version "$NEW_VERSION" --no-git-tag-version --allow-same-version 2>/dev/null

# Update manifest.json
sed -i '' "s/\"version\": \"${CURRENT}\"/\"version\": \"${NEW_VERSION}\"/" manifest.json

echo "==> package.json + manifest.json updated to ${NEW_VERSION}"

# ─── 2. Build ───

echo "==> Building extension..."
npm run build

# ─── 3. Package .crx ───

# Generate signing key if it doesn't exist
if [ ! -f "$CRX_KEY" ]; then
  echo "==> Generating new extension signing key..."
  openssl genrsa -out "$CRX_KEY" 2048 2>/dev/null
  echo "    IMPORTANT: Back up ${CRX_KEY} — it locks the extension ID"
fi

CRX_OUT="${ROOT}/mythic-wallet.crx"
ZIP_OUT="${ROOT}/mythic-wallet-extension.zip"

# Create zip from dist
echo "==> Creating zip..."
cd "$DIST"
rm -f "$ZIP_OUT"
zip -r "$ZIP_OUT" . -x '*.DS_Store'

# Create .crx using openssl (Chrome CRX3 format)
echo "==> Packaging .crx..."

# CRX3 format: magic (4) + version (4) + header_size (4) + header + zip
# For simplicity, we'll create a CRX3 file manually

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Generate DER public key
openssl rsa -in "$CRX_KEY" -pubout -outform DER -out "$TEMP_DIR/pub.der" 2>/dev/null

# Sign the zip
openssl dgst -sha256 -binary -sign "$CRX_KEY" "$ZIP_OUT" > "$TEMP_DIR/sig.bin"

# Get sizes
PUB_SIZE=$(wc -c < "$TEMP_DIR/pub.der" | tr -d ' ')
SIG_SIZE=$(wc -c < "$TEMP_DIR/sig.bin" | tr -d ' ')

# Write CRX header
python3 -c "
import struct, sys
# CRX2 format (widely compatible)
magic = b'Cr24'
version = struct.pack('<I', 2)
pub_len = struct.pack('<I', ${PUB_SIZE})
sig_len = struct.pack('<I', ${SIG_SIZE})
sys.stdout.buffer.write(magic + version + pub_len + sig_len)
" > "$TEMP_DIR/header.bin"

cat "$TEMP_DIR/header.bin" "$TEMP_DIR/pub.der" "$TEMP_DIR/sig.bin" "$ZIP_OUT" > "$CRX_OUT"
echo "==> .crx created: $(ls -lh "$CRX_OUT" | awk '{print $5}')"

# Compute extension ID from public key
EXT_ID=$(openssl rsa -in "$CRX_KEY" -pubout -outform DER 2>/dev/null | shasum -a 256 | head -c 32 | tr '0-9a-f' 'a-p')
echo "==> Extension ID: ${EXT_ID}"

# ─── 4. Update server release manifest ───

if [ -d "$WALLET_SITE" ]; then
  echo "==> Updating extension-release.json..."
  cat > "${WALLET_SITE}/extension-release.json" << EOF
{
  "version": "${NEW_VERSION}",
  "changelog": "",
  "downloadUrl": "https://wallet.mythic.sh/extension/mythic-wallet.crx",
  "extensionId": "${EXT_ID}",
  "releasedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
  echo "    Set changelog in ${WALLET_SITE}/extension-release.json if needed"
fi

# ─── 5. Copy .crx to wallet site public dir ───

if [ -d "$WALLET_SITE" ]; then
  mkdir -p "${WALLET_SITE}/public/extension"
  cp "$CRX_OUT" "${WALLET_SITE}/public/extension/mythic-wallet.crx"
  cp "$ZIP_OUT" "${WALLET_SITE}/public/extension/mythic-wallet.zip"
  echo "==> Copied .crx + .zip to wallet site public/extension/"
fi

# ─── Done ───

echo ""
echo "=== Release v${NEW_VERSION} ready ==="
echo ""
echo "  .crx: ${CRX_OUT}"
echo "  .zip: ${ZIP_OUT}"
echo "  ID:   ${EXT_ID}"
echo ""
echo "Next steps:"
echo "  1. Set changelog in ${WALLET_SITE}/extension-release.json"
echo "  2. Deploy wallet site: cd ${WALLET_SITE} && npm run build"
echo "  3. Push to server: rsync + pm2 restart mythic-wallet-site"
echo ""

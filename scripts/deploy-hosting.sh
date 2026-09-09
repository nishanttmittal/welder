#!/usr/bin/env bash
# Deploy the welder app to the REAL production home: Firebase Hosting at
# https://unico-operations.firebaseapp.com/welder/  (what the workers' installed
# iPhone PWA actually opens).
#
# WHY THIS EXISTS: `npm run deploy` publishes to GitHub Pages only. On 2026-09-09
# four gh-pages deploys in a row "succeeded" while Anshul stayed stuck on the
# 26-Aug build, because his phone was never pointed at github.io. Deploying to
# Pages alone is NOT a deploy to the factory.
set -euo pipefail
SITE=/home/nishel/unico-default-site
APP=welder
BK="$HOME/.claude/backups/${APP}-hosting-$(date +%Y%m%d-%H%M%S)"

cd "$(dirname "$0")/.."
echo "▶ building (base=/${APP}/)…"
npm run build

echo "▶ backing up the live copy → $BK"
mkdir -p "$BK"; cp -r "$SITE/public/$APP" "$BK/"

echo "▶ staging new build into $SITE/public/$APP"
rm -rf "$SITE/public/$APP"; cp -r dist "$SITE/public/$APP"

echo "▶ deploying Hosting (whole site; other apps redeploy byte-identical from public/)"
cd "$SITE"
GOOGLE_APPLICATION_CREDENTIALS=/home/nishel/attendance-app/jobs/firebase-admin.json \
  firebase deploy --only hosting --project unico-operations --non-interactive

WANT=$(grep -o "/$APP/assets/index-[A-Za-z0-9_-]*\.js" "public/$APP/index.html" | head -1)
echo "▶ verifying $WANT is live…"
for i in 1 2 3 4 5; do
  GOT=$(curl -s "https://unico-operations.firebaseapp.com/$APP/" | grep -oE "/$APP/assets/index-[A-Za-z0-9_-]+\.js" | head -1 || true)
  [ "$GOT" = "$WANT" ] && { echo "✅ LIVE: $GOT"; exit 0; }
  echo "   not yet ($GOT) — retrying"; sleep 10
done
echo "🔴 could not confirm the new asset is live — check manually"; exit 1

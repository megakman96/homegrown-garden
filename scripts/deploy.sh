#!/usr/bin/env bash
set -e

PROXMOX="root@192.168.2.2"
LXC_ID="112"
DIST="$(dirname "$0")/../dist"

echo "🔍 Getting tunnel URL from LXC $LXC_ID..."
# Try named tunnel hostname first (from config.yml ingress)
TUNNEL_URL=$(ssh "$PROXMOX" \
  "pct exec $LXC_ID -- grep -oP 'hostname: \K\S+' /root/.cloudflared/config.yml 2>/dev/null | head -1" \
  | sed 's/^/https:\/\//')

# Fall back to quick-tunnel URL in journal logs
if [ -z "$TUNNEL_URL" ] || [ "$TUNNEL_URL" = "https://" ]; then
  TUNNEL_URL=$(ssh "$PROXMOX" \
    "pct exec $LXC_ID -- journalctl -u cloudflared --no-pager -n 200" \
    | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1)
fi

if [ -z "$TUNNEL_URL" ] || [ "$TUNNEL_URL" = "https://" ]; then
  echo "❌ Could not find tunnel URL. Is cloudflared running on LXC $LXC_ID?"
  echo "   Run: ssh $PROXMOX \"pct exec $LXC_ID -- systemctl status cloudflared\""
  exit 1
fi

echo "🌐 Tunnel URL: $TUNNEL_URL"

# Update .env
ENV_FILE="$(dirname "$0")/../.env"
echo "EXPO_PUBLIC_PB_URL=$TUNNEL_URL" > "$ENV_FILE"
echo "✅ Updated .env"

# Use Node 22 via fnm if available
export PATH="$HOME/.local/share/fnm:$PATH"
if command -v fnm &>/dev/null; then
  eval "$(fnm env --use-on-cd)"
  fnm use 22 --silent 2>/dev/null || true
fi

echo "📦 Building Expo web..."
cd "$(dirname "$0")/.."
npx expo export --platform web
node scripts/inject-pwa.js

echo "📤 Deploying to LXC $LXC_ID..."
# Stage on Proxmox host then copy into container
ssh "$PROXMOX" "rm -rf /tmp/hg-deploy && mkdir -p /tmp/hg-deploy"
scp -r dist/* "$PROXMOX:/tmp/hg-deploy/"
ssh "$PROXMOX" "
  cd /tmp/hg-deploy
  tar czf /tmp/hg-deploy.tar.gz .
  pct push $LXC_ID /tmp/hg-deploy.tar.gz /tmp/hg-deploy.tar.gz
  pct exec $LXC_ID -- bash -c 'rm -rf /opt/homegrown/dist && mkdir -p /opt/homegrown/dist && tar xzf /tmp/hg-deploy.tar.gz -C /opt/homegrown/dist/'
  rm -f /tmp/hg-deploy.tar.gz /tmp/hg-deploy.tar.gz
"

echo ""
echo "✅ Deploy complete!"
echo "   App: $TUNNEL_URL"
echo "   Admin: $TUNNEL_URL/_/"

# Hetzner VPS Deployment

The production VPS runs the app as a Next.js standalone server managed by PM2.

- **Server:** `snel-bot` (SSH alias)
- **App directory:** `/opt/voice-hotline-celo`
- **Port:** `3042`
- **PM2 process name:** `voice-hotline-celo`

---

## Initial Setup

### 1. Clone the repo

```bash
ssh snel-bot
cd /opt
git clone https://github.com/sneldao/voice-agent-hotline voice-hotline-celo
cd voice-hotline-celo
```

### 2. Install dependencies

```bash
npm install --production
npm install --save-dev pino-pretty  # required by walletconnect logger
```

### 3. Configure environment

```bash
cp .env.local.example .env.local
nano .env.local  # fill in all values
```

Key variables:

```env
NODE_ENV=production
PORT=3042
HOSTNAME=0.0.0.0

ELEVENLABS_API_KEY=
UPSTASH_REDIS_REST_URL=https://harmless-chigger-79190.upstash.io
UPSTASH_REDIS_REST_TOKEN=

NEXT_PUBLIC_ERC8004_ENABLED=true
NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e
NEXT_PUBLIC_ERC8004_REPUTATION_ADDRESS=0x8004B663056A597Dffe9eCcC1965A193B7388713
NEXT_PUBLIC_ERC8004_DELEGATION_ADDRESS=0xb17A8dC3E37B9b95282cEA6594c1dFAa16026D00
```

### 4. Build

```bash
npm run build
```

This produces `.next/standalone/` — the self-contained server bundle.

### 5. Configure ecosystem.config.js

The standalone server does **not** auto-load `.env.local`. All env vars must be injected via `ecosystem.config.js`.

Run this once to sync `.env.local` into the PM2 config:

```bash
node -e "
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && !k.startsWith('#')) env[k.trim()] = v.join('=').trim();
});
const cfg = fs.readFileSync('ecosystem.config.js', 'utf8');
const updated = cfg.replace(/env:\s*\{[^}]*\}/, 'env: ' + JSON.stringify(env, null, 6));
fs.writeFileSync('ecosystem.config.js', updated);
console.log('Updated', Object.keys(env).length, 'keys');
"
```

Verify `ecosystem.config.js` has `cwd` set:

```js
module.exports = {
  apps: [{
    name: 'voice-hotline-celo',
    script: '.next/standalone/server.js',
    cwd: '/opt/voice-hotline-celo',   // required
    env: { /* all vars from .env.local */ }
  }]
}
```

### 6. Start with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # follow the printed command to enable auto-start on reboot
```

### 7. Seed agents

```bash
curl -X POST http://localhost:3042/api/agents/seed
```

---

## Routine Updates

```bash
ssh snel-bot "cd /opt/voice-hotline-celo && git pull origin main && npm run build && pm2 restart voice-hotline-celo && pm2 save"
```

If `.env.local` changed, re-sync env vars into `ecosystem.config.js` before restarting (see step 5 above), then:

```bash
pm2 delete voice-hotline-celo
pm2 start ecosystem.config.js
pm2 save
```

---

## Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name voisss.celo.famile.xyz;

    location / {
        proxy_pass http://localhost:3042;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable HTTPS with Certbot:

```bash
certbot --nginx -d voisss.celo.famile.xyz
```

---

## Monitoring

```bash
# Process status
pm2 status

# Live logs
pm2 logs voice-hotline-celo

# Last 20 log lines
pm2 logs voice-hotline-celo --lines 20 --nostream

# Restart
pm2 restart voice-hotline-celo

# Memory / CPU monitor
pm2 monit
```

---

## Upstash Redis

The app uses Upstash Redis (REST API) for all persistent data. No local Redis is required.

Current instance: `harmless-chigger-79190.upstash.io`

Test connectivity:

```bash
curl -s -H "Authorization: Bearer <UPSTASH_REDIS_REST_TOKEN>" \
  https://harmless-chigger-79190.upstash.io/ping
# Expected: {"result":"PONG"}
```

If you need to replace the Redis instance, update both `.env.local` and `ecosystem.config.js`, then delete and restart the PM2 process.

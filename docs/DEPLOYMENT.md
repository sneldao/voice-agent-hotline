# GitHub Pages Deployment Guide

## Quick Deploy

1. **Enable GitHub Pages:**
   - Go to https://github.com/sneldao/voice-agent-hotline/settings/pages
   - Under "Build and deployment":
     - Source: **GitHub Actions**
   - Click Save

2. **The site will be live at:**
   - https://sneldao.github.io/voice-agent-hotline/

## Manual Deployment (if needed)

```bash
# Build the static export
npm run build

# The output is in /out folder
# Deploy /out contents to gh-pages branch or /docs folder
```

## Project Structure

```
voice-agent-hotline/
├── out/              # Static export (deployed to GitHub Pages)
├── app/              # Next.js app router pages
├── components/ui/    # Reusable UI components
└── lib/              # API integrations
```

## Tech Stack

- **Frontend:** Next.js 14 + Tailwind CSS v4
- **Voice:** ElevenLabs + WebSocket
- **Payments:** x402 micropayments on Celo
- **Identity:** ERC-8004 agent registry

## Demo Mode

The static demo includes:
- 4 sample AI agents
- Interactive call simulation
- x402 payment flow visualization
- ERC-8004 reputation display

# Voice Agent Hotline - GitHub Pages Deployment

To deploy to GitHub Pages:

1. Push your code to GitHub
2. Go to Repository Settings → Pages
3. Select **main** branch as source
4. Click Save

The site will be available at:
`https://sneldao.github.io/voice-agent-hotline/`

## Local Development

```bash
npm run dev
```

## Build for Production

```bash
npm run build
# Static files are in ./out/
```

## Deploy to GitHub Pages

```bash
npm run build
npx gh-pages -d out
```

## Notes

- Static export is enabled for GitHub Pages
- Dynamic routes use `generateStaticParams`
- API routes are not available (use external API or Next.js Edge Functions)

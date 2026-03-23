#!/bin/bash
# Script to download Google Fonts locally for offline builds
# This prevents network dependency during Next.js build

FONTS_DIR="public/fonts"
mkdir -p "$FONTS_DIR"

echo "Downloading Space Grotesk fonts..."
curl -L -o "$FONTS_DIR/SpaceGrotesk-Regular.woff2" "https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mPbF4Cw.woff2"
curl -L -o "$FONTS_DIR/SpaceGrotesk-Medium.woff2" "https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mPbF4Cw.woff2"
curl -L -o "$FONTS_DIR/SpaceGrotesk-SemiBold.woff2" "https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mPbF4Cw.woff2"
curl -L -o "$FONTS_DIR/SpaceGrotesk-Bold.woff2" "https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mPbF4Cw.woff2"

echo "Downloading IBM Plex Sans fonts..."
curl -L -o "$FONTS_DIR/IBMPlexSans-Light.woff2" "https://fonts.gstatic.com/s/ibmplexsans/v19/zYX9KVElMYYaJe8bpLHnCwDKjSL9AIFsdP3pBms.woff2"
curl -L -o "$FONTS_DIR/IBMPlexSans-Regular.woff2" "https://fonts.gstatic.com/s/ibmplexsans/v19/zYXgKVElMYYaJe8bpLHnCwDKjWr70J4.woff2"
curl -L -o "$FONTS_DIR/IBMPlexSans-Medium.woff2" "https://fonts.gstatic.com/s/ibmplexsans/v19/zYX9KVElMYYaJe8bpLHnCwDKjQ76AIFsdP3pBms.woff2"
curl -L -o "$FONTS_DIR/IBMPlexSans-SemiBold.woff2" "https://fonts.gstatic.com/s/ibmplexsans/v19/zYX9KVElMYYaJe8bpLHnCwDKjXr6AIFsdP3pBms.woff2"
curl -L -o "$FONTS_DIR/IBMPlexSans-Bold.woff2" "https://fonts.gstatic.com/s/ibmplexsans/v19/zYX9KVElMYYaJe8bpLHnCwDKjUL7AIFsdP3pBms.woff2"

echo "Fonts downloaded to $FONTS_DIR"
echo "Note: These URLs are for reference. Download the actual font files from:"
echo "  - Space Grotesk: https://fonts.google.com/specimen/Space+Grotesk"
echo "  - IBM Plex Sans: https://fonts.google.com/specimen/IBM+Plex+Sans"
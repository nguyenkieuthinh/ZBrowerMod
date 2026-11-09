# Quick Translate

Quick Translate pairs a web page with a Claude custom connector. Claude sends text to a temporary channel; the page displays it and can read it aloud with the browser's speech synthesis.

## Use

1. Open the deployed Quick Translate page and create a channel.
2. Copy its eight-character code.
3. In Claude, add a custom remote connector using `https://zbrower-quick-translate.inwardsugar4.chatgpt.site/mcp`.
4. Ask Claude to use **Display text in Quick Translate**, providing the channel code and text.
5. Return to the page and press the speaker button to listen.

Each channel code is a temporary bearer secret. Anyone who knows it can send text to that page. Channels expire after 24 hours and the latest text expires after 15 minutes. The service stores only a hash of the channel code.

## Development

The hosted application is in [`sites/quick-translate`](sites/quick-translate). It uses Cloudflare Workers and D1, with the schema migration in `sites/quick-translate/drizzle/`.

```sh
cd sites/quick-translate
npm install
npm run build
node --test lib/channel-store.test.js
```

The site must be deployed over HTTPS for Claude's remote MCP connection. Add the `/mcp` URL as a custom connector in Claude; the site does not require a Quick Translate account.

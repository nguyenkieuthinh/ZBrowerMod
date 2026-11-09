<div align="center">

# Quick Translate

### Let Claude write. Listen from your browser.

Send Claude's response to a lightweight page, then read it on screen or play it aloud with your browser's voice.

[Open Quick Translate](https://zbrower-quick-translate.inwardsugar4.chatgpt.site) · [Connect Claude](#connect-claude) · [How it works](#how-it-works)

![Illustrative preview of the Quick Translate page paired with Claude](sites/quick-translate/public/readme-preview.png)

</div>

## Connect Claude

1. Open [Quick Translate](https://zbrower-quick-translate.inwardsugar4.chatgpt.site) and select **Create a channel**.
2. Copy the eight-character channel code shown on the page.
3. In Claude, add a custom remote connector with this URL:

   `https://zbrower-quick-translate.inwardsugar4.chatgpt.site/claude-mcp`

4. Start a Claude chat and ask it to use **Display text in Quick Translate**. Share the channel code and the text you want sent.
5. The page updates automatically. Choose a voice language and press **Listen**.

## How it works

Quick Translate is a small companion display for reading and listening to Claude responses. It does not translate text automatically; Claude can translate it when you ask, then send the result to your paired page.

- **No Quick Translate account:** open the public page and create a temporary channel.
- **Private pairing code:** each channel uses a random eight-character code.
- **Live delivery:** Claude sends text through the remote MCP connector and the page checks for updates.
- **Listen aloud:** speech uses your browser's built-in text-to-speech voices.
- **Short retention:** channels expire after 24 hours; their latest message is removed after 15 minutes.

Treat the channel code like a password: anyone who has it can send text to that page. The service stores a hash of the code, not the code itself.

### No sound?

Open the page directly in a browser tab, press **Listen**, and check your device's media volume. If the page reports that a voice is unavailable, choose another voice under **Voice settings** or install a speech voice for that language on your device.

## Run locally

The hosted application is in [`sites/quick-translate`](sites/quick-translate). It uses Cloudflare Workers and D1.

```sh
cd sites/quick-translate
npm install
npm run build
node --test lib/channel-store.test.js
```

To connect Claude, the MCP endpoint must be deployed at a public HTTPS URL. See the [implementation notes](docs/superpowers/specs/2026-11-09-claude-translate-display-design.md) for architecture details.

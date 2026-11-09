# Design: Claude Text Handoff for Quick Translate

## Intent

The repository contains a static translation page in `index.html`. It accepts text, translates through MyMemory, and reads text with the browser's available speech voices. The user wants an English-first, Google Translate-style page where they can ask Claude on the web to prepare or translate text, send the result to the page, and press the speaker button to hear it. The repository and the deployed app/MCP endpoint should be public so Claude users can add and use the connector without creating an app account.

## Primary flow

1. A visitor opens Quick Translate and creates a random, 8-character channel code. The page provides a copy button.
2. The visitor adds the public MCP URL as a custom connector in their Claude account, then gives Claude the channel code in a conversation and asks it to translate or prepare text for the page.
3. Claude calls the MCP tool `display_text` with the channel code and the final text.
4. The page receives the update, displays it in the result pane, and selects a speech language when supplied.
5. The visitor presses the speaker button to hear the text using browser speech synthesis.

## Goals

- Keep the current translation, language selection, voice settings, and speech controls while making all user-facing page copy English-first.
- Add a remote MCP server using Streamable HTTP with one tool: `display_text`.
- The tool accepts `channel_code`, `text` (1–5000 characters), and optional `language` (BCP 47 language tag). The visitor copies the channel code from the page and shares it with Claude in the conversation.
- Deploy the app and MCP endpoint to a public HTTPS URL. Any Claude account that supports custom connectors can add that URL without signing in to this app.
- Push the source to the public GitHub repository `nguyenkieuthinh/ZBrowerMod`.
- Keep the app runnable locally for development.
- Use a responsive layout with keyboard and screen-reader support for connection, update, and speech controls.

## Out of scope

- No Claude API calls or embedded Claude chat UI.
- No Google Calendar integration or Google account permissions.
- No submission to Anthropic's Connector Directory; users add the public custom connector URL themselves.
- Do not replace MyMemory in the page's existing translation workflow.

## Implementation direction

- Host the public app with the available Sites platform using its Worker-backed web runtime and D1 for shared channel state. Keep the existing lightweight HTML/CSS/JS experience; use only the framework/runtime pieces required by the hosting starter.
- Expose Claude's remote MCP endpoint at `/mcp` using Streamable HTTP and the official MCP TypeScript SDK. This is a Claude-compatible remote MCP endpoint, not the Sites-generated ChatGPT plugin endpoint.
- Generate channel codes server-side with a cryptographically secure random generator. Codes are exactly eight uppercase alphanumeric characters, excluding visually ambiguous characters. A channel code is a bearer secret: anyone who knows it can access that channel.
- Do not require app accounts, OAuth, or a connector-wide bearer token. Store the current text per channel, not a message history. Store channel state in D1 so multiple Worker instances can serve the same page and Claude calls.
- A channel expires after 24 hours without activity. Its current text expires 15 minutes after the last update. Do not log text or channel codes. Limit input to 5000 characters, reject blank text and invalid language tags, and rate-limit channel creation and tool calls to reduce code guessing and spam.
- Serve the page and APIs from the same origin. The page polls for its channel's latest text and keeps the channel code in localStorage, not in the URL.
- Provide local run instructions and public custom connector setup instructions in English.

## Constraints and notes

- Claude Web calls remote MCP from Anthropic infrastructure, so the endpoint must be reachable over public HTTPS.
- The eight-character code is the access key to a channel. Anyone given the code can send text to or read the current text from that channel; code strength, rate limits, and expiration are required.
- Text sent through the connector passes through the hosted app. The page shows only the latest text; the visitor starts speech playback manually. Text expires after 15 minutes.
- Available speech voices depend on the visitor's browser and operating system; a Google voice is not guaranteed on every device.
- Users can add the connector by URL; public hosting does not automatically list it in Anthropic's Connector Directory.

## Acceptance criteria

- The English-first site and its MCP endpoint run locally.
- A visitor can create and copy a channel code; the code pairs only with the page opened using the same local channel state.
- An MCP client can call `display_text`; the latest text appears in the matching page without reloading.
- The speaker button reads the received text in the requested language when a matching browser voice is available; existing translation and speech features continue to work.
- README explains local startup, channel codes, and adding the public connector in Claude.
- The GitHub repository is public and contains the pushed implementation; the website and MCP endpoint are publicly deployed and the public URL is provided. The connector is not submitted to the Anthropic Directory.

## Sources

- Claude's remote MCP guidance: https://claude.com/docs/connectors/building
- Adding a custom connector in Claude: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp

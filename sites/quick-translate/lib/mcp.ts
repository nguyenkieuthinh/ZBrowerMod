import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import { createD1ChannelRepository, publishText } from "./channel-store.js";

export function createQuickTranslateMcpHandler(db: D1Database) {
  const repository = createD1ChannelRepository(db);

  return createMcpHandler(() => {
    const server = new McpServer(
      { name: "quick-translate", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );

    server.registerTool(
      "display_text",
      {
        title: "Display text in Quick Translate",
        description:
          "Send final text to the Quick Translate page paired with the eight-character channel code. The visitor can read it and play it using their browser voice.",
        inputSchema: z.object({
          channel_code: z.string().regex(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/),
          text: z.string().min(1).max(5000),
          language: z.string().max(64).optional(),
        }),
      },
      async ({ channel_code, text, language }) => {
        await publishText(repository, {
          channelCode: channel_code,
          text,
          language,
        });
        return {
          content: [{
            type: "text",
            text: "Text sent to the paired Quick Translate page. The visitor can press the speaker button to listen.",
          }],
        };
      },
    );

    return server;
  }, { maxRequestBodySize: 64 * 1024 });
}

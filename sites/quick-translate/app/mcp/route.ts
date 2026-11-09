import { hostHeaderValidationResponse } from "@modelcontextprotocol/server";
import { env } from "cloudflare:workers";
import { createQuickTranslateMcpHandler } from "../../lib/mcp";

const ALLOWED_HOSTS = [
  "zbrower-quick-translate.inwardsugar4.chatgpt.site",
  "localhost",
  "127.0.0.1",
  "::1",
];

async function handle(request: Request) {
  const rejected = hostHeaderValidationResponse(request, ALLOWED_HOSTS);
  if (rejected) return rejected;
  if (!env.DB) {
    return Response.json({ error: "Channel storage is unavailable." }, { status: 503 });
  }

  const handler = createQuickTranslateMcpHandler(env.DB);
  return handler.fetch(request);
}

export const POST = handle;
export const GET = handle;

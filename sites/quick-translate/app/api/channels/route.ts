import { env } from "cloudflare:workers";
import { ChannelStoreError, createChannel, createD1ChannelRepository } from "../../../lib/channel-store.js";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  if (!env.DB) {
    return Response.json({ error: "Channel storage is unavailable." }, { status: 503 });
  }

  try {
    const code = await createChannel(createD1ChannelRepository(env.DB), {
      clientKey: request.headers.get("cf-connecting-ip") || "unknown-client",
    });
    return Response.json({ code }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ChannelStoreError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Could not create a channel. Please try again." }, { status: 500 });
  }
}

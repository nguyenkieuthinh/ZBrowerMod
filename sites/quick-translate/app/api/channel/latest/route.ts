import { env } from "cloudflare:workers";
import { ChannelStoreError, createD1ChannelRepository, readLatest } from "../../../../lib/channel-store.js";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

async function parseBody(request: Request) {
  const body = await request.text();
  if (body.length > 1024) throw new ChannelStoreError("invalid_request", "Request is too large.", 413);
  try {
    return JSON.parse(body);
  } catch {
    throw new ChannelStoreError("invalid_request", "Request must be valid JSON.", 400);
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
    const body = await parseBody(request);
    const latest = await readLatest(createD1ChannelRepository(env.DB), {
      channelCode: body?.channel_code,
    });
    if (!latest) {
      return Response.json({ error: "This channel has expired. Create a new one." }, {
        status: 404,
        headers: { "cache-control": "no-store" },
      });
    }
    return Response.json({
      text: latest.text,
      language: latest.language,
      updated_at: latest.updatedAt,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ChannelStoreError) {
      return Response.json({ error: error.message }, {
        status: error.status,
        headers: { "cache-control": "no-store" },
      });
    }
    return Response.json({ error: "Could not read this channel." }, { status: 500 });
  }
}

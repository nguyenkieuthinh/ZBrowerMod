const LANGUAGES = new Set([
  "vi-VN", "en-US", "ja-JP", "ko-KR", "zh-CN", "fr-FR", "de-DE",
  "es-ES", "th-TH", "ru-RU", "it-IT", "pt-BR", "id-ID",
]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const text = params.get("q")?.trim() || "";
  const language = params.get("tl") || "en-US";
  const speed = Number(params.get("speed") || "1");

  if (!text || Array.from(text).length > 180) {
    return Response.json({ error: "Speech text must be between 1 and 180 characters." }, { status: 400 });
  }
  if (!LANGUAGES.has(language)) {
    return Response.json({ error: "Unsupported speech language." }, { status: 400 });
  }
  if (!Number.isFinite(speed) || speed < 0.5 || speed > 1.8) {
    return Response.json({ error: "Unsupported speech speed." }, { status: 400 });
  }

  const upstreamUrl = new URL("https://translate.google.com/translate_tts");
  upstreamUrl.search = new URLSearchParams({
    ie: "UTF-8",
    client: "tw-ob",
    tl: language,
    ttsspeed: String(speed),
    q: text,
  }).toString();

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { "user-agent": "Mozilla/5.0 QuickTranslate/1.0" },
    });
    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !contentType.includes("audio/")) {
      return Response.json({ error: "The online speech provider could not create audio." }, {
        status: 502,
        headers: { "cache-control": "no-store" },
      });
    }
    return new Response(upstream.body, {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "The online speech provider could not be reached." }, {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }
}

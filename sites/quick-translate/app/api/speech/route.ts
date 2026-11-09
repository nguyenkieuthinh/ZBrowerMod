import speechModule from "../../../lib/speech.js?raw";

export async function GET() {
  return new Response(speechModule, {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": "text/javascript; charset=utf-8",
    },
  });
}

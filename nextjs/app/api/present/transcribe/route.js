import { transcribe } from "../../../../lib/transcribe.mjs";

export const dynamic = "force-dynamic";

// One chunk of a take, a few seconds of audio/webm, for the live transcript. Body: multipart `audio`, `prompt`.
export async function POST(request) {
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) return Response.json({ error: "OPENROUTER_API_KEY isn't set in nextjs/.env.local." }, { status: 500 });
  let form;
  try { form = await request.formData(); } catch { return Response.json({ error: "Expected a multipart form." }, { status: 400 }); }
  const audio = form.get("audio");
  if (!audio || typeof audio.arrayBuffer !== "function") return Response.json({ error: "No audio in the request." }, { status: 400 });
  try {
    const text = await transcribe(Buffer.from(await audio.arrayBuffer()), { apiKey, model: process.env.TRANSCRIBE_MODEL, type: audio.type || "audio/webm", prompt: String(form.get("prompt") || "") });
    return Response.json({ text });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 502 });
  }
}

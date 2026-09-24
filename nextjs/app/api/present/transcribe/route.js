import { transcribeDraft } from "../../../../lib/transcribe.mjs";

export const dynamic = "force-dynamic";

// One live chunk of a take (a WAV cut at a pause) for the draft transcript. Body: multipart `audio`, `prompt`.
// Returns { text, segments } with segment times relative to the chunk.
export async function POST(request) {
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) return Response.json({ error: "OPENROUTER_API_KEY isn't set in nextjs/.env.local." }, { status: 500 });
  let form;
  try { form = await request.formData(); } catch { return Response.json({ error: "Expected a multipart form." }, { status: 400 }); }
  const audio = form.get("audio");
  if (!audio || typeof audio.arrayBuffer !== "function") return Response.json({ error: "No audio in the request." }, { status: 400 });
  try {
    return Response.json(await transcribeDraft(Buffer.from(await audio.arrayBuffer()), { apiKey, model: process.env.TRANSCRIBE_MODEL, type: audio.type || "audio/wav", prompt: String(form.get("prompt") || "") }));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 502 });
  }
}

import { revisePassage } from "../../../../lib/revise.mjs";

export const dynamic = "force-dynamic";

// The slow pass: one passage of a take. Body: multipart `audio` (WAV), `draft` (JSON: Whisper segments with times
// in seconds from the start of the take), `context` (the settled text before it), `topic`.
// Returns { text, careful, model }.
export async function POST(request) {
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) return Response.json({ error: "OPENROUTER_API_KEY isn't set in nextjs/.env.local." }, { status: 500 });
  let form;
  try { form = await request.formData(); } catch { return Response.json({ error: "Expected a multipart form." }, { status: 400 }); }
  const audio = form.get("audio");
  if (!audio || typeof audio.arrayBuffer !== "function") return Response.json({ error: "No audio in the request." }, { status: 400 });
  let draft = [];
  try { draft = JSON.parse(String(form.get("draft") || "[]")); } catch {}
  try {
    return Response.json(await revisePassage({
      audio: Buffer.from(await audio.arrayBuffer()),
      draft,
      context: String(form.get("context") || ""),
      topic: String(form.get("topic") || ""),
      apiKey,
      model: process.env.REVISE_MODEL,
      transcribeModel: process.env.REVISE_TRANSCRIBE_MODEL,
    }));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 502 });
  }
}

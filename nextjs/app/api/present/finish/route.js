import { followUps, saveTake } from "../../../../lib/present.mjs";
import { transcribe } from "../../../../lib/transcribe.mjs";

export const dynamic = "force-dynamic";

// The end of a take. Body: multipart `audio` (the whole take), optional `slide` (JPEG), `topic`, `role`, and `live`
// (the chunked transcript, used if the clean pass fails). Transcribes the whole take in one pass, asks for
// follow-ups, and saves everything to _media/present/<stamp>/.
export async function POST(request) {
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) return Response.json({ error: "OPENROUTER_API_KEY isn't set in nextjs/.env.local." }, { status: 500 });
  let form;
  try { form = await request.formData(); } catch { return Response.json({ error: "Expected a multipart form." }, { status: 400 }); }
  const audio = form.get("audio");
  if (!audio || typeof audio.arrayBuffer !== "function") return Response.json({ error: "No audio in the request." }, { status: 400 });
  const slideFile = form.get("slide");
  const slide = slideFile && typeof slideFile.arrayBuffer === "function" ? Buffer.from(await slideFile.arrayBuffer()) : null;
  const topic = String(form.get("topic") || "").trim();
  const role = String(form.get("role") || "examiner");
  const bytes = Buffer.from(await audio.arrayBuffer());

  const result = {};
  try {
    result.transcript = await transcribe(bytes, { apiKey, model: process.env.TRANSCRIBE_MODEL, type: audio.type || "audio/webm", prompt: topic ? `Topic: ${topic}.` : "" });
  } catch (error) {
    result.transcript = String(form.get("live") || "");
    result.transcribeError = error.message;
  }
  if (result.transcript) {
    try {
      result.followups = await followUps({ transcript: result.transcript, topic, role, slide, apiKey, model: process.env.OPENROUTER_MODEL });
    } catch (error) {
      result.followupsError = error.message;
    }
  }
  try {
    result.saved = await saveTake({ audio: bytes, slide, topic, role, transcript: result.transcript, followups: result.followups });
  } catch (error) {
    result.saveError = error.message;
  }
  return Response.json(result);
}

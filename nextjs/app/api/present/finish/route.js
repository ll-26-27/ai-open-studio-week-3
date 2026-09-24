import { followUps, saveTake } from "../../../../lib/present.mjs";

export const dynamic = "force-dynamic";

// The end of a take, after the revisions are in. Body: multipart `audio` (the whole take as WAV), optional `slide`
// (JPEG), `topic`, `role`, `transcript` (the revised text), and `record` (JSON: every live chunk and passage, kept
// with the take). Asks for follow-ups and saves everything to _media/present/<stamp>/.
export async function POST(request) {
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) return Response.json({ error: "OPENROUTER_API_KEY isn't set in nextjs/.env.local." }, { status: 500 });
  let form;
  try { form = await request.formData(); } catch { return Response.json({ error: "Expected a multipart form." }, { status: 400 }); }
  const audio = form.get("audio");
  const slideFile = form.get("slide");
  const slide = slideFile && typeof slideFile.arrayBuffer === "function" ? Buffer.from(await slideFile.arrayBuffer()) : null;
  const topic = String(form.get("topic") || "").trim();
  const role = String(form.get("role") || "examiner");
  const transcript = String(form.get("transcript") || "").trim();
  const record = String(form.get("record") || "");

  const result = {};
  if (transcript) {
    try {
      result.followups = await followUps({ transcript, topic, role, slide, apiKey, model: process.env.OPENROUTER_MODEL });
    } catch (error) {
      result.followupsError = error.message;
    }
  }
  try {
    const bytes = audio && typeof audio.arrayBuffer === "function" ? Buffer.from(await audio.arrayBuffer()) : null;
    result.saved = await saveTake({ audio: bytes, slide, topic, role, transcript, followups: result.followups, record });
  } catch (error) {
    result.saveError = error.message;
  }
  return Response.json(result);
}

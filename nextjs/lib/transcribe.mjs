// Speech to text with Whisper Large V3 on OpenRouter (the same OPENROUTER_API_KEY as the image descriptions).
// Groq and Together answer in about half a second; the cheapest provider can take ten seconds or more, so the
// request asks for the fast two first. TRANSCRIBE_MODEL in .env.local overrides the model.

export const defaultTranscribeModel = "openai/whisper-large-v3";

export async function transcribe(bytes, { apiKey, model, filename = "audio.webm", type = "audio/webm", prompt = "" }) {
  const form = new FormData();
  form.append("model", model || defaultTranscribeModel);
  form.append("file", new Blob([bytes], { type }), filename);
  form.append("language", "en");
  form.append("provider", JSON.stringify({ order: ["groq", "together"], allow_fallbacks: true }));
  // Whisper uses the prompt as preceding context: the topic's vocabulary and the end of the transcript so far.
  if (prompt) form.append("prompt", prompt.slice(-800));
  const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
  return (data.text || "").trim();
}

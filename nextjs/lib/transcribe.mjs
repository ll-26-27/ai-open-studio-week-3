// Speech to text on OpenRouter (the same OPENROUTER_API_KEY as the image descriptions).
//
// The live draft uses Whisper Large V3, which returns segment timestamps and a confidence (avg_logprob) per segment.
// Groq and Together answer in about half a second; the cheapest provider can take ten seconds or more, so the
// request asks for the fast two first. The revision pass uses OpenAI's GPT Transcribe, slower and more accurate.
// TRANSCRIBE_MODEL and REVISE_TRANSCRIBE_MODEL in .env.local override the two.

export const draftModel = "openai/whisper-large-v3";
export const reviseTranscribeModel = "openai/gpt-transcribe";

async function post(form, apiKey) {
  const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
  return data;
}

function audioForm(bytes, { model, filename, type, prompt }) {
  const form = new FormData();
  form.append("model", model);
  form.append("file", new Blob([bytes], { type }), filename);
  form.append("language", "en");
  // The prompt is preceding context: the topic's vocabulary and the end of the transcript so far.
  if (prompt) form.append("prompt", prompt.slice(-800));
  return form;
}

// Whisper, with timestamps: { text, segments: [{ start, end, text, confidence }] }, times in seconds from the start
// of this audio.
export async function transcribeDraft(bytes, { apiKey, model, filename = "chunk.wav", type = "audio/wav", prompt = "" }) {
  const form = audioForm(bytes, { model: model || draftModel, filename, type, prompt });
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.append("provider", JSON.stringify({ order: ["groq", "together"], allow_fallbacks: true }));
  const data = await post(form, apiKey);
  const segments = (data.segments || []).map((segment) => ({ start: segment.start, end: segment.end, text: (segment.text || "").trim(), confidence: segment.avg_logprob }));
  return { text: (data.text || "").trim(), segments };
}

// Plain text from the slower, more accurate model.
export async function transcribeCareful(bytes, { apiKey, model, filename = "passage.wav", type = "audio/wav", prompt = "" }) {
  const data = await post(audioForm(bytes, { model: model || reviseTranscribeModel, filename, type, prompt }), apiKey);
  return (data.text || "").trim();
}

import { defaultModel } from "./describe.mjs";
import { transcribeCareful } from "./transcribe.mjs";

// The slow pass over the live transcript. A passage is roughly 30 seconds of a take, cut at a pause. Its audio goes
// to GPT Transcribe; then a text model (REVISE_MODEL, default Claude Opus 5.5; openai/gpt-5.6-terra also works)
// reads both transcripts, Whisper's with timestamps and confidence, and writes the passage's final text.

export const reviseModel = "anthropic/claude-opus-5.5";

function stamp(seconds) {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
}

export async function revisePassage({ audio, draft, context, topic, apiKey, model, transcribeModel }) {
  const careful = await transcribeCareful(audio, { apiKey, model: transcribeModel, prompt: [topic && `Topic: ${topic}.`, context].filter(Boolean).join(" ") });
  const whisper = draft.length
    ? draft.map((segment) => `[${stamp(segment.start)}–${stamp(segment.end)}] (confidence ${segment.confidence?.toFixed?.(2) ?? "?"}) ${segment.text}`).join("\n")
    : "(no speech detected in the live draft)";
  if (!careful && !draft.some((segment) => segment.text)) return { text: "", careful, model: null };

  const prompt = [
    "You are writing the final transcript of one passage of a student's spoken presentation.",
    `Topic: ${topic || "(not given)"}.`,
    context ? `The settled transcript just before this passage, for context only (don't repeat it): "…${context.slice(-600)}"` : "This passage is the start of the talk.",
    "",
    "Transcript A, from Whisper Large V3 as the student spoke, with timestamps (minutes:seconds into the take) and each segment's average log-probability (closer to 0 is more confident):",
    whisper,
    "",
    "Transcript B, from OpenAI GPT Transcribe, of the same audio, without timestamps:",
    careful || "(empty)",
    "",
    "Write the most accurate transcript of what the speaker said in this passage. Where A and B agree, keep it. Where they differ, choose the likelier hearing given the sound, the topic, and the context; B is usually better on words and names, and A may catch words B dropped. Keep the speaker's own wording and grammar; don't improve their argument or add anything. Drop filler sounds (um, uh).",
    "Output only the passage text as plain sentences, with no quotation marks, labels, or commentary. If neither transcript contains speech, output nothing.",
  ].join("\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "ai-open-studio-week-3 revise" },
    body: JSON.stringify({ model: model || reviseModel || defaultModel, max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
  const out = data.choices?.[0]?.message?.content;
  const text = (Array.isArray(out) ? out.map((part) => part.text || "").join("") : out || "").trim();
  return { text, careful, model: data.model || model || reviseModel };
}

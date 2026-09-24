import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { mediaRoot } from "./media.mjs";
import { defaultModel } from "./describe.mjs";

// Who asks the follow-ups after a take on /present.
export const roles = {
  examiner: { label: "Examiner", who: "an examiner at an oral exam in this subject" },
  peer: { label: "Curious peer", who: "a curious classmate in the audience who wants to understand" },
  skeptic: { label: "Skeptical reviewer", who: "a skeptical expert reviewer in the field" },
};

export async function followUps({ transcript, topic, role, slide, apiKey, model }) {
  const asker = (roles[role] || roles.examiner).who;
  const text = [
    `You are ${asker}. A student has just given a short spoken presentation${slide ? " with the attached slide on screen" : ""}.`,
    `Topic or assignment: ${topic || "(not given)"}.`,
    "The transcript below is automatic speech-to-text, so a word that looks wrong may be a transcription error rather than the student's error; don't pick on those.",
    "Respond in Markdown with exactly two sections:",
    "## Follow-up questions — three questions, most important first, one sentence each: what you would ask right after the talk, each grounded in something they said or left out.",
    `## Notes — two or three bullets: where the explanation was unclear or skipped a step, a claim that needs evidence or an example${slide ? ", and any mismatch between what they said and what the slide shows" : ""}. Quote their words briefly when you point at something.`,
    "No praise, no preamble, no grade, and don't rewrite the talk.",
    "",
    "Transcript:",
    transcript,
  ].join("\n");
  const content = [{ type: "text", text }];
  if (slide) content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${Buffer.from(slide).toString("base64")}` } });
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "ai-open-studio-week-3 present" },
    body: JSON.stringify({ model: model || defaultModel, max_tokens: 900, messages: [{ role: "user", content }] }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
  const out = data.choices?.[0]?.message?.content;
  return (Array.isArray(out) ? out.map((part) => part.text || "").join("") : out || "").trim();
}

function stamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

// Each take is a folder in _media/present/: the audio, the slide as it was at the end, and take.md.
export async function saveTake({ audio, slide, topic, role, transcript, followups }) {
  const name = stamp();
  const directory = path.join(mediaRoot, "present", name);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "take.webm"), audio);
  if (slide) await writeFile(path.join(directory, "slide.jpg"), slide);
  const markdown = [`# Take ${name}`, "", `- **Topic:** ${topic || "(not given)"}`, `- **Follow-ups from:** ${(roles[role] || roles.examiner).label}`, "", "## Transcript", "", transcript || "(nothing transcribed)", "", followups || ""].join("\n");
  await writeFile(path.join(directory, "take.md"), markdown + "\n");
  return `present/${name}`;
}

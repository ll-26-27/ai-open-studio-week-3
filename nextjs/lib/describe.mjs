// A short description of each capture from a vision model on OpenRouter (OPENROUTER_API_KEY, OPENROUTER_MODEL in
// .env.local). The prompt asks for the station's vocabulary, so the wall reads like the day's glossary in use.

export const defaultModel = "anthropic/claude-sonnet-5";

const common = "Answer in two or three plain sentences, no preamble, no praise, no hedging, and don't guess who anyone is.";

const prompts = {
  lights: "This still was captured at the studio-lights station of a class on camera and lighting craft. Say how the subject is lit: where the key light is (as a clock position seen from above, with the subject facing the camera at 12), whether it is hard or soft, whether there is fill, a back light, rim, or kicker, where the catchlights are, and any color in the light.",
  cameras: "This still was captured at the studio-camera station of a class on camera craft. Say how it is framed: shot size, camera angle, where the subject sits in the frame (thirds, center, look room), depth of field, and whether the subject is looking into the lens or off it.",
  obscura: "This still was captured at the camera-obscura station of a class on camera craft. It is probably a picture of a projected image: a lens throwing an image onto frosted acrylic or ground glass, a projector, or a camera pointed at its own monitor. Say what the image shows and what the apparatus added: inversion, vignetting, a hot spot, texture, blur, color casts, or recursion.",
  phone: "This still was captured at the phone station of a class on camera craft. Say what is in the frame and how it was shot: framing, light, and anything the phone's processing seems to have done.",
  other: "This still was captured in a class on camera and lighting craft. Say what is in the frame and how it is lit and framed.",
};

// Writing gets a transcription, not a two-sentence description, so it has its own prompt, format, and length.
const writingPrompt = [
  "This still shows writing on one or more pieces of paper, cards, sticky notes, or a whiteboard, photographed during a workshop.",
  "For each piece, in reading order (top to bottom, then left to right), write a Markdown heading `### <n>. <the surface>` that describes it: what it is (index card, sticky note, notebook page, printer paper, whiteboard), its color, any ruling or grid, and what it is written with (pen, pencil, marker, and the ink color).",
  "Under each heading, transcribe the text exactly as written, keeping its line breaks and lists. Show crossed-out words as ~~struck~~. Put [illegible] where you cannot read a word rather than guessing, and describe drawings, arrows, or diagrams briefly in [square brackets].",
  "If a piece is blank, say so under its heading. If there is only one piece, still give it a heading.",
  "No preamble, no summary, no commentary on the content, and don't guess who wrote it.",
].join(" ");

export const maxTokens = { writing: 2000 };

export async function describeImage(bytes, station, { apiKey, model }) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "tdm155ai-week-3 capture" },
    body: JSON.stringify({
      model: model || defaultModel,
      max_tokens: maxTokens[station] || 300,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: station === "writing" ? writingPrompt : `${prompts[station] || prompts.other} ${common}` },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}` } },
        ],
      }],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
  const text = data.choices?.[0]?.message?.content;
  const description = (Array.isArray(text) ? text.map((part) => part.text || "").join("") : text || "").trim();
  if (!description) throw new Error("empty description");
  return description;
}

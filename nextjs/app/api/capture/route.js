import { captureConfig, captureFilename, postSlack, publicConfig, saveLocal, saveNas, saveSidecar, slackToken, stations, withTimeout } from "../../../lib/capture.mjs";
import { defaultModel, describeImage } from "../../../lib/describe.mjs";
import { mediaRoot } from "../../../lib/media.mjs";

export const dynamic = "force-dynamic";

const maxBytes = 25 * 1024 * 1024;

// The capture page asks which targets are configured on this machine.
export async function GET() {
  return Response.json(publicConfig());
}

// Body: multipart form with `image` (a JPEG from the page's canvas), `station`, and `describe` / `slack` / `nas` ("1" to do that).
export async function POST(request) {
  let form;
  try { form = await request.formData(); } catch { return Response.json({ error: "Expected a multipart form." }, { status: 400 }); }

  const image = form.get("image");
  const station = String(form.get("station") || "other");
  if (!Object.hasOwn(stations, station)) return Response.json({ error: `Unknown station "${station}".` }, { status: 400 });
  if (!image || typeof image.arrayBuffer !== "function") return Response.json({ error: "No image in the request." }, { status: 400 });
  if (image.size > maxBytes) return Response.json({ error: "Image is too large." }, { status: 413 });

  const bytes = Buffer.from(await image.arrayBuffer());
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return Response.json({ error: "Only JPEG captures are accepted." }, { status: 415 });

  const config = captureConfig();
  const filename = captureFilename(station, config.machine);

  let src;
  try { src = await saveLocal(bytes, station, filename); } catch (error) { return Response.json({ error: `Could not save locally: ${error.message}` }, { status: 500 }); }

  const result = { filename, src, local: "saved" };

  // The description runs first because the Slack post carries it; the NAS copy doesn't wait for it.
  const described = form.get("describe") === "1" && config.openrouterKey
    ? withTimeout(describeImage(bytes, station, { apiKey: config.openrouterKey, model: config.openrouterModel }), station === "writing" ? 90000 : 30000, "Description")
      .then((text) => { result.description = text; }, (error) => { result.describe = `failed: ${error.message}`; })
    : Promise.resolve();

  const tasks = [described];
  if (form.get("nas") === "1" && config.nasDir) {
    tasks.push(withTimeout(saveNas(bytes, station, filename, config.nasDir), 8000, "NAS").then(() => { result.nas = "saved"; }, (error) => { result.nas = `failed: ${error.code === "ENOENT" ? "NAS folder not found (is the share mounted?)" : error.message}`; }));
  }
  if (form.get("slack") === "1" && slackToken(config) && config.slackChannel) {
    tasks.push(described.then(() => {
      const comment = [`${stations[station]} · ${config.machine}`, result.description && result.description.split("\n").map((line) => `> ${line}`).join("\n")].filter(Boolean).join("\n");
      const post = postSlack(bytes, filename, { token: slackToken(config), channel: config.slackChannel, comment, publicLink: Boolean(config.slackUserToken) });
      return withTimeout(post, 30000, "Slack");
    }).then(({ url, markdown }) => { result.slack = "posted"; if (url) Object.assign(result, { url, markdown }); }, (error) => { result.slack = `failed: ${error.message}`; }));
  }
  await Promise.all(tasks);

  if (result.description) {
    const sidecar = { description: result.description, model: config.openrouterModel || defaultModel, station, machine: config.machine, created: new Date().toISOString(), ...(result.url ? { url: result.url } : {}) };
    await saveSidecar(mediaRoot, station, filename, sidecar).catch(() => {});
    if (result.nas === "saved") await withTimeout(saveSidecar(config.nasDir, station, filename, sidecar), 8000, "NAS").catch(() => {});
  }
  return Response.json(result);
}

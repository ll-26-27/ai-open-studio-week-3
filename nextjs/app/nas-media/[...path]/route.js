import path from "node:path";
import { captureConfig } from "../../../lib/capture.mjs";
import { mediaResponse } from "../../../lib/media.mjs";

export const dynamic = "force-dynamic";

// Experimental: serves files out of the NAS folder (CAPTURE_NAS_DIR) for /live/nas.
export async function GET(request, { params }) {
  const { nasDir } = captureConfig();
  if (!nasDir) return new Response("Not found", { status: 404 });
  const { path: segments = [] } = await params;
  return mediaResponse(request, segments, path.resolve(nasDir));
}

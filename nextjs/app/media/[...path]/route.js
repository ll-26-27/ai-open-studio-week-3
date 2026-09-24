import { mediaResponse } from "../../../lib/media.mjs";

export const dynamic = "force-dynamic";

// Serves files out of _media/ at the repo root.
export async function GET(request, { params }) {
  const { path: segments = [] } = await params;
  return mediaResponse(request, segments);
}

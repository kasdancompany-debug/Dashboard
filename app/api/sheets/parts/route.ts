import { fetchSheetRows, isLiveDataEnabled } from "@/src/lib/google/sheets-client";
import { badRequest, ok, serverError } from "@/src/lib/google/route-utils";

export async function GET() {
  if (!isLiveDataEnabled()) {
    return badRequest("LIVE_DATA_ENABLED must be true. Mock fallback is disabled.");
  }
  try {
    return ok(await fetchSheetRows("parts"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch parts sheet.";
    if (message.includes("Missing required environment variable")) return badRequest(message);
    return serverError(message);
  }
}

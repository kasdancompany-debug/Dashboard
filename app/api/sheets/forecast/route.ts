import { fetchSheetRows, isLiveDataEnabled } from "@/src/lib/google/sheets-client";
import { badRequest, ok, serverError } from "@/src/lib/google/route-utils";

export async function GET() {
  if (!isLiveDataEnabled()) {
    return badRequest("Live data mode is disabled. Set LIVE_DATA_ENABLED=true.");
  }

  try {
    const data = await fetchSheetRows("forecast");
    return ok(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch forecast sheet.";
    if (message.includes("Missing required environment variable")) {
      return badRequest(message);
    }
    return serverError(message);
  }
}

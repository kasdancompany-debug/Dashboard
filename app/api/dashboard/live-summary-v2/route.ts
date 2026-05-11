import { NextRequest } from "next/server";

import { isLiveDataEnabled } from "@/src/lib/google/sheets-client";
import { badRequest, ok, serverError } from "@/src/lib/google/route-utils";
import { getVelocityData } from "@/src/lib/velocity/get-velocity-data";

export async function GET(request: NextRequest) {
  if (!isLiveDataEnabled()) {
    return badRequest("LIVE_DATA_ENABLED must be true. Mock fallback is disabled for this endpoint.");
  }

  try {
    const payload = await getVelocityData({
      reportingMonth: request.nextUrl.searchParams.get("reportingMonth"),
    });
    return ok(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch live dashboard summary.";
    if (message.includes("Missing required environment variable")) {
      return badRequest(message);
    }
    return serverError(message);
  }
}

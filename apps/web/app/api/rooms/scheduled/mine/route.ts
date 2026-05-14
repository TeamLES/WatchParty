import { NextResponse } from "next/server";

import { getAccessTokenFromCookies } from "@/lib/cookies";
import { getWebPublicEnv } from "@/lib/env";
import { joinUrl } from "@/lib/utils";

export async function GET(): Promise<NextResponse> {
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const env = getWebPublicEnv();
    const response = await fetch(
      joinUrl(env.NEXT_PUBLIC_API_BASE_URL, "/api/rooms/scheduled/mine"),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      },
    );
    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Rooms upstream unavailable" },
      { status: 502 },
    );
  }
}

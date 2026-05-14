import { NextResponse } from "next/server";

import {
  getAccessTokenFromCookies,
  getIdTokenFromCookies,
} from "@/lib/cookies";
import { getWebPublicEnv } from "@/lib/env";
import { joinUrl } from "@/lib/utils";

export async function POST(request: Request): Promise<NextResponse> {
  const accessToken = await getAccessTokenFromCookies();
  const idToken = await getIdTokenFromCookies();

  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const env = getWebPublicEnv();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };

    if (idToken) {
      headers["X-WatchParty-Id-Token"] = idToken;
    }

    const response = await fetch(
      joinUrl(env.NEXT_PUBLIC_API_BASE_URL, "/api/rooms/scheduled"),
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );
    const responseText = await response.text();

    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Rooms upstream unavailable" },
      { status: 502 },
    );
  }
}

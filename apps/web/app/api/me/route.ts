import { NextResponse } from "next/server";

import {
  getAccessTokenFromCookies,
  getIdTokenFromCookies,
} from "@/lib/cookies";
import { getWebPublicEnv } from "@/lib/env";
import { joinUrl } from "@/lib/utils";

export async function GET(): Promise<NextResponse> {
  const accessToken = await getAccessTokenFromCookies();
  const idToken = await getIdTokenFromCookies();

  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const env = getWebPublicEnv();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    if (idToken) {
      headers["X-WatchParty-Id-Token"] = idToken;
    }

    const response = await fetch(
      joinUrl(env.NEXT_PUBLIC_API_BASE_URL, "/api/auth/me"),
      {
        method: "GET",
        headers,
        cache: "no-store",
      },
    );

    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ message: "Auth upstream unavailable" }, { status: 502 });
  }
}

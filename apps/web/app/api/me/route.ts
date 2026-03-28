import { NextResponse } from "next/server";

import { getAccessTokenFromCookies } from "@/lib/cookies";
import { getWebPublicEnv } from "@/lib/env";

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/g, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export async function GET(): Promise<NextResponse> {
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const env = getWebPublicEnv();
    const response = await fetch(
      joinUrl(env.NEXT_PUBLIC_API_BASE_URL, "/api/auth/me"),
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
        "Content-Type": response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ message: "Auth upstream unavailable" }, { status: 502 });
  }
}
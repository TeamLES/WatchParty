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

  try {
    const env = getWebPublicEnv();
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(
      joinUrl(env.NEXT_PUBLIC_API_BASE_URL, "/api/rooms"),
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
    return NextResponse.json({ message: "Rooms upstream unavailable" }, { status: 502 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const accessToken = await getAccessTokenFromCookies();

  try {
    const body = await request.json();
    const env = getWebPublicEnv();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(
      joinUrl(env.NEXT_PUBLIC_API_BASE_URL, "/api/rooms"),
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
        "Content-Type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json({ message: "Rooms upstream unavailable" }, { status: 502 });
  }
}

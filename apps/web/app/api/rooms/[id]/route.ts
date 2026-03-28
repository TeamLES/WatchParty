import { NextResponse } from "next/server";

import { getAccessTokenFromCookies } from "@/lib/cookies";
import { getWebPublicEnv } from "@/lib/env";

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/g, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const accessToken = await getAccessTokenFromCookies();

  try {
    const env = getWebPublicEnv();
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(
      joinUrl(env.NEXT_PUBLIC_API_BASE_URL, `/api/rooms/${id}`),
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

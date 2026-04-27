import { createHmac, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getCurrentUserFromApi } from "@/lib/auth";

const DEFAULT_TICKET_TTL_SECONDS = 300;

interface WebSocketTicketPayload {
  sub: string;
  iat: number;
  exp: number;
  nonce: string;
}

function readTicketTtlSeconds(): number {
  const ttl = Number(process.env.WS_TICKET_TTL_SECONDS);

  if (!Number.isFinite(ttl) || ttl < 30) {
    return DEFAULT_TICKET_TTL_SECONDS;
  }

  return Math.min(Math.floor(ttl), 900);
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

export async function GET(): Promise<NextResponse> {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  const ticketSecret = process.env.WS_TICKET_SECRET;

  if (!wsUrl || !ticketSecret) {
    return NextResponse.json(
      { message: "WebSocket realtime is not configured" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const currentUser = await getCurrentUserFromApi();

  if (!currentUser?.sub) {
    return NextResponse.json(
      { message: "Unauthorized" },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: WebSocketTicketPayload = {
    sub: currentUser.sub,
    iat: now,
    exp: now + readTicketTtlSeconds(),
    nonce: randomUUID(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const ticket = `${encodedPayload}.${signPayload(encodedPayload, ticketSecret)}`;

  return NextResponse.json(
    {
      wsUrl,
      ticket,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}

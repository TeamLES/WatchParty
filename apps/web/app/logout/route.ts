import { NextResponse } from "next/server";

import { buildCognitoLogoutUrl } from "@/lib/auth";
import { clearPendingAuthCookies, clearSessionTokenCookies } from "@/lib/cookies";

export async function GET(): Promise<NextResponse> {
  const response = NextResponse.redirect(buildCognitoLogoutUrl());
  clearPendingAuthCookies(response);
  clearSessionTokenCookies(response);

  return response;
}

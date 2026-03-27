import { NextResponse } from "next/server";

import { buildCognitoAuthorizeUrl } from "@/lib/auth";
import { setPendingAuthCookies } from "@/lib/cookies";
import { generatePkcePair, generateState } from "@/lib/pkce";

export async function GET(): Promise<NextResponse> {
  const state = generateState();
  const pkce = generatePkcePair();

  const authorizeUrl = buildCognitoAuthorizeUrl({
    state,
    codeChallenge: pkce.codeChallenge,
  });

  const response = NextResponse.redirect(authorizeUrl);
  setPendingAuthCookies(response, {
    state,
    codeVerifier: pkce.codeVerifier,
  });

  return response;
}

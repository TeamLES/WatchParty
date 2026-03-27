import { type NextRequest, NextResponse } from "next/server";

import { exchangeCodeForTokens } from "@/lib/auth";
import {
  clearPendingAuthCookies,
  readPendingAuthCookies,
  setSessionTokenCookies,
} from "@/lib/cookies";

function redirectToLoginWithError(
  request: NextRequest,
  errorCode: string,
): NextResponse {
  const redirectUrl = new URL("/auth/login", request.url);
  redirectUrl.searchParams.set("error", errorCode);

  const response = NextResponse.redirect(redirectUrl);
  clearPendingAuthCookies(response);

  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cognitoError = request.nextUrl.searchParams.get("error");

  if (cognitoError) {
    return redirectToLoginWithError(request, cognitoError);
  }

  const code = request.nextUrl.searchParams.get("code");
  const stateFromCallback = request.nextUrl.searchParams.get("state");

  if (!code || !stateFromCallback) {
    return redirectToLoginWithError(request, "missing_code_or_state");
  }

  const pendingAuthCookies = readPendingAuthCookies(request);

  if (!pendingAuthCookies) {
    return redirectToLoginWithError(request, "missing_auth_session");
  }

  if (pendingAuthCookies.state !== stateFromCallback) {
    return redirectToLoginWithError(request, "invalid_state");
  }

  try {
    const tokens = await exchangeCodeForTokens(code, pendingAuthCookies.codeVerifier);

    const response = NextResponse.redirect(new URL("/", request.url));
    clearPendingAuthCookies(response);
    setSessionTokenCookies(response, {
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
    });

    return response;
  } catch {
    return redirectToLoginWithError(request, "token_exchange_failed");
  }
}

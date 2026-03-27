import { cookies } from "next/headers";
import { type NextRequest, type NextResponse } from "next/server";

export const AUTH_STATE_COOKIE_NAME = "watchparty_auth_state";
export const PKCE_VERIFIER_COOKIE_NAME = "watchparty_pkce_verifier";
export const ACCESS_TOKEN_COOKIE_NAME = "watchparty_access_token";
export const ID_TOKEN_COOKIE_NAME = "watchparty_id_token";
export const REFRESH_TOKEN_COOKIE_NAME = "watchparty_refresh_token";

const isProduction = process.env.NODE_ENV === "production";

function baseCookieOptions(maxAgeInSeconds: number) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeInSeconds,
  };
}

export interface PendingAuthCookies {
  state: string;
  codeVerifier: string;
}

export interface SessionTokenCookies {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn: number;
}

export function setPendingAuthCookies(
  response: NextResponse,
  pendingAuth: PendingAuthCookies,
): void {
  const authFlowMaxAge = 60 * 10;

  response.cookies.set(
    AUTH_STATE_COOKIE_NAME,
    pendingAuth.state,
    baseCookieOptions(authFlowMaxAge),
  );
  response.cookies.set(
    PKCE_VERIFIER_COOKIE_NAME,
    pendingAuth.codeVerifier,
    baseCookieOptions(authFlowMaxAge),
  );
}

export function readPendingAuthCookies(
  request: NextRequest,
): PendingAuthCookies | null {
  const state = request.cookies.get(AUTH_STATE_COOKIE_NAME)?.value;
  const codeVerifier = request.cookies.get(PKCE_VERIFIER_COOKIE_NAME)?.value;

  if (!state || !codeVerifier) {
    return null;
  }

  return { state, codeVerifier };
}

export function clearPendingAuthCookies(response: NextResponse): void {
  response.cookies.delete(AUTH_STATE_COOKIE_NAME);
  response.cookies.delete(PKCE_VERIFIER_COOKIE_NAME);
}

export function setSessionTokenCookies(
  response: NextResponse,
  tokens: SessionTokenCookies,
): void {
  const accessTokenMaxAge = Math.max(tokens.expiresIn, 60);

  response.cookies.set(
    ACCESS_TOKEN_COOKIE_NAME,
    tokens.accessToken,
    baseCookieOptions(accessTokenMaxAge),
  );

  if (tokens.idToken) {
    response.cookies.set(
      ID_TOKEN_COOKIE_NAME,
      tokens.idToken,
      baseCookieOptions(accessTokenMaxAge),
    );
  }

  if (tokens.refreshToken) {
    const refreshTokenMaxAge = 60 * 60 * 24 * 30;
    response.cookies.set(
      REFRESH_TOKEN_COOKIE_NAME,
      tokens.refreshToken,
      baseCookieOptions(refreshTokenMaxAge),
    );
  }
}

export function clearSessionTokenCookies(response: NextResponse): void {
  response.cookies.delete(ACCESS_TOKEN_COOKIE_NAME);
  response.cookies.delete(ID_TOKEN_COOKIE_NAME);
  response.cookies.delete(REFRESH_TOKEN_COOKIE_NAME);
}

export async function getAccessTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value ?? null;
}
import { getAccessTokenFromCookies } from "@/lib/cookies";
import { getWebPublicEnv } from "@/lib/env";

const COGNITO_SCOPES = ["openid", "email", "profile"];

export interface BuildAuthorizeUrlInput {
  state: string;
  codeChallenge: string;
}

export interface CognitoTokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

export interface AuthMeResponse {
  sub: string;
  username?: string;
  scope?: string;
  clientId?: string;
  tokenUse?: string;
  issuedAt?: number;
  expiresAt?: number;
}

function withHttpsIfMissing(domain: string): string {
  if (domain.startsWith("https://") || domain.startsWith("http://")) {
    return domain;
  }

  return `https://${domain}`;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/g, "");
}

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function getCognitoBaseUrl(): string {
  const env = getWebPublicEnv();
  return normalizeBaseUrl(withHttpsIfMissing(env.NEXT_PUBLIC_COGNITO_DOMAIN));
}

export function buildCognitoAuthorizeUrl(input: BuildAuthorizeUrlInput): string {
  const env = getWebPublicEnv();
  const url = new URL(joinUrl(getCognitoBaseUrl(), "/oauth2/authorize"));

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.NEXT_PUBLIC_COGNITO_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN);
  url.searchParams.set("scope", COGNITO_SCOPES.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", input.codeChallenge);

  return url.toString();
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<CognitoTokenResponse> {
  const env = getWebPublicEnv();
  const tokenEndpoint = joinUrl(getCognitoBaseUrl(), "/oauth2/token");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
    redirect_uri: env.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN,
    code,
    code_verifier: codeVerifier,
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Cognito token exchange failed (${response.status}): ${errorBody}`,
    );
  }

  const tokens = (await response.json()) as CognitoTokenResponse;

  if (!tokens.access_token || !tokens.id_token || !tokens.expires_in) {
    throw new Error("Cognito token response is missing required fields");
  }

  return tokens;
}

export function buildCognitoLogoutUrl(): string {
  const env = getWebPublicEnv();
  const url = new URL(joinUrl(getCognitoBaseUrl(), "/logout"));

  url.searchParams.set("client_id", env.NEXT_PUBLIC_COGNITO_CLIENT_ID);
  url.searchParams.set("logout_uri", env.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT);

  return url.toString();
}

export async function fetchApiWithAccessToken<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const env = getWebPublicEnv();
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    throw new Error("Access token cookie is missing");
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(joinUrl(env.NEXT_PUBLIC_API_BASE_URL, path), {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getCurrentUserFromApi(): Promise<AuthMeResponse | null> {
  try {
    return await fetchApiWithAccessToken<AuthMeResponse>("/api/auth/me");
  } catch {
    return null;
  }
}
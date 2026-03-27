export interface HealthResponse {
  ok: true;
  service: "api";
}

export interface AuthUser {
  sub: string;
  email?: string;
  username?: string;
}

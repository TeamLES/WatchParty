export interface AuthMeResponse {
  sub: string;
  username?: string;
  email?: string;
  scope?: string;
  clientId?: string;
  tokenUse: string;
  issuedAt: number;
  expiresAt: number;
}

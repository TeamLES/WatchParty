export interface AuthMeResponse {
  sub: string;
  username?: string;
  scope?: string;
  clientId?: string;
  tokenUse: string;
  issuedAt: number;
  expiresAt: number;
}

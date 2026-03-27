import { z } from "zod";

const webPublicEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_AWS_REGION: z.string().min(1),
  NEXT_PUBLIC_COGNITO_USER_POOL_ID: z.string().min(1),
  NEXT_PUBLIC_COGNITO_CLIENT_ID: z.string().min(1),
  NEXT_PUBLIC_COGNITO_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN: z.string().url(),
  NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT: z.string().url(),
});

export type WebPublicEnv = z.infer<typeof webPublicEnvSchema>;

let cachedWebPublicEnv: WebPublicEnv | null = null;

function formatEnvError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}

export function getWebPublicEnv(): WebPublicEnv {
  if (cachedWebPublicEnv) {
    return cachedWebPublicEnv;
  }

  const parsed = webPublicEnvSchema.safeParse({
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION,
    NEXT_PUBLIC_COGNITO_USER_POOL_ID: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
    NEXT_PUBLIC_COGNITO_CLIENT_ID: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
    NEXT_PUBLIC_COGNITO_DOMAIN: process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
    NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN:
      process.env.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN,
    NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT:
      process.env.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT,
  });

  if (!parsed.success) {
    throw new Error(`Invalid frontend environment: ${formatEnvError(parsed.error)}`);
  }

  cachedWebPublicEnv = parsed.data;
  return cachedWebPublicEnv;
}
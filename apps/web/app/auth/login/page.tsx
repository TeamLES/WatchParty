import { FilmIcon, LockKeyholeIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  token_exchange_failed:
    "We could not complete sign in with Cognito. Please try again.",
  missing_code_or_state:
    "The sign-in response was incomplete. Please start login again.",
  missing_auth_session:
    "Your login session expired before callback completed. Please try again.",
  invalid_state:
    "Your login session could not be verified. Please start a fresh login.",
};

function normalizeErrorCode(errorParam: string | string[] | undefined): string | null {
  if (!errorParam) {
    return null;
  }

  if (Array.isArray(errorParam)) {
    return errorParam[0] ?? null;
  }

  return errorParam;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorCode = normalizeErrorCode(resolvedSearchParams?.error);
  const errorMessage = errorCode
    ? LOGIN_ERROR_MESSAGES[errorCode] ??
    "Sign in failed. Reset the session and try again."
    : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,rgba(244,63,94,0.12),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(34,197,94,0.12),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(14,165,233,0.12),transparent_45%)] px-6 py-16">
      <section className="mx-auto grid w-full max-w-5xl items-center gap-8 md:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Badge variant="secondary" className="w-fit">
            University MVP
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Start your WatchParty with Cognito Managed Login
          </h1>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            Authentication is hosted by Cognito. This app uses Authorization
            Code Flow with PKCE and server-side token exchange.
          </p>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <LockKeyholeIcon className="size-4" />
            No client secret in the frontend app client.
          </div>
        </div>

        <Card className="border-border/70 bg-card/95 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FilmIcon className="size-4" />
              Sign in to continue
            </CardTitle>
            <CardDescription>
              Continue to Cognito Hosted UI for sign in or sign up.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {errorMessage ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium">Login issue: {errorMessage}</p>
                <p className="mt-1 text-xs text-destructive/90">
                  If this keeps happening, click Logout / Reset session and try
                  again.
                </p>
              </div>
            ) : null}
            <Button asChild className="w-full">
              <a href="/auth/login/start">Continue with Cognito</a>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <a href="/auth/login/start">Create account in Hosted UI</a>
            </Button>
            <Button asChild variant="destructive" className="w-full">
              <a href="/logout">Logout / Reset session</a>
            </Button>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              After login, Cognito redirects back to /auth/callback.
            </p>
          </CardFooter>
        </Card>
      </section>
    </main>
  );
}

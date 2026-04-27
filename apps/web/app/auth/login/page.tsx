import { ArrowLeftIcon, FilmIcon, LockKeyholeIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
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

function normalizeErrorCode(
  errorParam: string | string[] | undefined,
): string | null {
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
    ? (LOGIN_ERROR_MESSAGES[errorCode] ??
      "Sign in failed. Reset the session and try again.")
    : null;

  return (
    <main className="page-surface min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.22),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(139,92,246,0.16),transparent_38%),linear-gradient(180deg,#f9f5ff,#efe7ff)] px-6 py-14 text-foreground dark:bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.22),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(139,92,246,0.16),transparent_40%),linear-gradient(180deg,#09090b,#150a20)]">
      <section className="relative mx-auto grid w-full max-w-5xl items-start gap-10 md:grid-cols-[1fr_440px]">
        <div className="pointer-events-none absolute right-6 top-1/2 -z-10 hidden h-72 w-72 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl md:block" />
        <div className="space-y-6">
          <Badge
            variant="secondary"
            className="w-fit bg-primary/15 text-primary"
          >
            Secure Auth
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Continue to WatchParty
          </h1>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            Sign in with Cognito Hosted UI to enter rooms, invite friends, and
            keep your session secure across devices.
          </p>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <LockKeyholeIcon className="size-4" />
            PKCE-enabled flow with server-side token exchange.
          </div>
        </div>

        <Card className="rounded-2xl border-border/60 bg-card/85 shadow-[0_20px_60px_rgba(124,58,237,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/40 dark:shadow-[0_20px_60px_rgba(168,85,247,0.22)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FilmIcon className="size-4" />
              Sign in
            </CardTitle>
            <CardDescription>
              You will be redirected to Cognito and then back to this app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {errorMessage ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium">Login issue: {errorMessage}</p>
                <p className="mt-1 text-xs text-destructive/90">
                  If this repeats, reset your session and start again.
                </p>
              </div>
            ) : null}

            <div className="text-center">
              <a
                href="/auth/login/start"
                className="text-sm font-semibold text-primary underline decoration-primary/70 underline-offset-6 transition-colors hover:text-primary/80"
              >
                Continue to Sign In
              </a>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Need a fresh session?{" "}
              <a
                href="/logout"
                className="font-medium text-primary hover:underline"
              >
                Logout and reset
              </a>
            </p>
          </CardContent>
          <CardFooter className="justify-end border-t border-border/60 pt-4 dark:border-white/10">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeftIcon className="size-3.5" />
              Back
            </Link>
          </CardFooter>
        </Card>
      </section>
    </main>
  );
}

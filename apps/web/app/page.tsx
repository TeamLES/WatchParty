import Link from "next/link";
import {
  FilmIcon,
  LogInIcon,
  LogOutIcon,
  ShieldCheckIcon,
  UserRoundIcon,
} from "lucide-react";

import { SampleRhfZodForm } from "@/components/forms/sample-rhf-zod-form";
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
import { getCurrentUserFromApi } from "@/lib/auth";
import { getAccessTokenFromCookies } from "@/lib/cookies";

export default async function Home() {
  const apiBaseUrl = (
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001"
  ).replace(/\/+$/g, "");
  const accessToken = await getAccessTokenFromCookies();
  const isAuthenticated = Boolean(accessToken);
  const currentUser = isAuthenticated ? await getCurrentUserFromApi() : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(251,191,36,0.12),transparent_30%),radial-gradient(circle_at_75%_20%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(14,165,233,0.1),transparent_45%)] px-6 py-12">
      <section className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border-border/60 bg-card/95 backdrop-blur">
          <CardHeader>
            <Badge variant="secondary" className="mb-2 w-fit">
              WatchParty MVP
            </Badge>
            <CardTitle className="text-3xl tracking-tight sm:text-4xl">
              Watch together, from anywhere.
            </CardTitle>
            <CardDescription className="max-w-2xl text-base">
              Next.js App Router + NestJS boilerplate with Cognito managed
              login, Authorization Code Flow + PKCE, and protected API route
              testing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/70 bg-muted/50 p-4">
              <p className="text-sm font-medium text-foreground">Auth status</p>
              {currentUser ? (
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2 text-foreground">
                    <ShieldCheckIcon className="size-4" />
                    Signed in and token verified by backend
                  </p>
                  <p>sub: {currentUser.sub}</p>
                  <p>username: {currentUser.username ?? "(not in token)"}</p>
                  <p>scope: {currentUser.scope ?? "(scope not returned)"}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Not signed in yet, or backend verification is not configured.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Button asChild>
                  <Link href="/logout" className="gap-2">
                    <LogOutIcon className="size-4" />
                    Logout
                  </Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/auth/login" className="gap-2">
                    <LogInIcon className="size-4" />
                    Login
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <a href={`${apiBaseUrl}/api/auth/me`} className="gap-2">
                  <UserRoundIcon className="size-4" />
                  Test GET /api/auth/me
                </a>
              </Button>
            </div>
          </CardContent>
          <CardFooter>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <FilmIcon className="size-3.5" />
              Room sync and chat are intentionally excluded from this MVP stage.
            </p>
          </CardFooter>
        </Card>

        <SampleRhfZodForm />
      </section>
    </main>
  );
}

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

export default function LoginPage() {
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
            <Button asChild className="w-full">
              <a href="/auth/login/start">Continue with Cognito</a>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <a href="/auth/login/start">Create account in Hosted UI</a>
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

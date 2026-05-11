import { type ReactNode } from "react";
import { redirect } from "next/navigation";

import { AuthenticatedHeader } from "@/components/app/authenticated-header";
import { getAccessTokenFromCookies } from "@/lib/cookies";

interface HighlightsLayoutProps {
  children: ReactNode;
}

export default async function HighlightsLayout({
  children,
}: HighlightsLayoutProps) {
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    redirect("/auth/login");
  }

  return (
    <>
      <AuthenticatedHeader />
      {children}
    </>
  );
}

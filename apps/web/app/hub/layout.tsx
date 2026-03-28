import { type ReactNode } from "react";
import { redirect } from "next/navigation";

import { getAccessTokenFromCookies } from "@/lib/cookies";

interface HubLayoutProps {
  children: ReactNode;
}

export default async function HubLayout({ children }: HubLayoutProps) {
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    redirect("/auth/login");
  }

  return <>{children}</>;
}

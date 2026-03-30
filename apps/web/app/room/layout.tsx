import { type ReactNode } from "react";
import { redirect } from "next/navigation";

import { AuthenticatedHeader } from "@/components/app/authenticated-header";
import { getAccessTokenFromCookies } from "@/lib/cookies";

interface RoomLayoutProps {
  children: ReactNode;
}

export default async function RoomLayout({ children }: RoomLayoutProps) {
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    redirect("/auth/login");
  }

  return (
    <>
      <AuthenticatedHeader />
      <div className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(251,191,36,0.06),transparent_30%),radial-gradient(circle_at_75%_20%,rgba(16,185,129,0.06),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(14,165,233,0.04),transparent_45%)]">
        {children}
      </div>
    </>
  );
}
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
      <div className="page-surface min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.14),transparent_34%),radial-gradient(circle_at_75%_20%,rgba(139,92,246,0.12),transparent_38%),radial-gradient(circle_at_50%_80%,rgba(192,132,252,0.1),transparent_46%)] dark:bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.16),transparent_36%),radial-gradient(circle_at_75%_20%,rgba(139,92,246,0.14),transparent_40%),radial-gradient(circle_at_50%_80%,rgba(192,132,252,0.12),transparent_50%)]">
        {children}
      </div>
    </>
  );
}

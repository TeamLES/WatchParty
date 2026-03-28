import { type ReactNode } from "react";
import { redirect } from "next/navigation";

import { getAccessTokenFromCookies } from "@/lib/cookies";

interface RoomLayoutProps {
  children: ReactNode;
}

export default async function RoomLayout({ children }: RoomLayoutProps) {
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    redirect("/auth/login");
  }

  return <>{children}</>;
}
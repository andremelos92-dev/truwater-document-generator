import type { Metadata } from "next";

import { LoginPage } from "@/components/login-page";

export const metadata: Metadata = { title: "Login · Truwater Document Generator" };

export default function Home() {
  return <LoginPage />;
}

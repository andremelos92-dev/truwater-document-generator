import type { Metadata } from "next";

import { AccountPanel } from "@/components/account-panel";

export const metadata: Metadata = { title: "Account · Truwater Document Generator" };

export default function AccountPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground mt-2">Your login, password and (master account) the other accounts.</p>
      </header>
      <AccountPanel />
    </main>
  );
}

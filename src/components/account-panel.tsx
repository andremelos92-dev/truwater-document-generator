"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, KeyRound, Loader2, LogOut, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Me = {
  username: string;
  name: string;
  master: boolean;
  users?: { username: string; name: string; hasPassword: boolean }[];
};

async function post(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? "Something went wrong. Please try again.");
}

export async function logOut() {
  await post("/api/auth/logout").catch(() => undefined);
  window.location.assign("/");
}

/** The signed-in account: change password, log out, and (master account) reset other people's passwords. */
export function AccountPanel() {
  const [me, setMe] = useState<Me | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/auth/me");
    if (response.ok) setMe(await response.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (next !== confirm) return setMessage({ text: "The new passwords don't match.", ok: false });
    setBusy("password");
    try {
      await post("/api/auth/password", { current, next });
      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage({ text: "Password changed.", ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Could not change the password.", ok: false });
    } finally {
      setBusy(null);
    }
  }

  async function reset(user: { username: string; name: string }) {
    if (!window.confirm(`Reset ${user.name}'s password? They'll create a new one the next time they log in.`)) return;
    setBusy(user.username);
    try {
      await post("/api/auth/reset", { username: user.username });
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not reset the password.");
    } finally {
      setBusy(null);
    }
  }

  if (!me) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </p>
    );
  }

  return (
    <div className="grid max-w-2xl gap-6">
      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1.5">
            <CardTitle>{me.name}</CardTitle>
            <CardDescription>
              Signed in as <span className="text-foreground font-medium">{me.username}</span>
              {me.master && " · master account"}
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => void logOut()}>
            <LogOut /> Log out
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" /> Change password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder="8+ characters"
                value={next}
                onChange={(event) => setNext(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
              <Button type="submit" disabled={!current || !next || busy === "password"}>
                {busy === "password" && <Loader2 className="animate-spin" />} Change password
              </Button>
              {message && (
                <p role="status" className={message.ok ? "text-sm text-emerald-700 dark:text-emerald-400" : "text-destructive text-sm"}>
                  {message.ok && <Check className="mr-1 inline size-4" />}
                  {message.text}
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {me.master && me.users && (
        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
            <CardDescription>
              Resetting a password clears it; that person creates a new one the next time they log in.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y">
              {me.users.map((user) => (
                <li key={user.username} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {user.name} <span className="text-muted-foreground font-normal">· {user.username}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {user.hasPassword ? "Password set" : "No password yet – created at first login"}
                    </p>
                  </div>
                  {user.username !== me.username && user.hasPassword && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void reset(user)}
                    >
                      {busy === user.username ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reset password
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

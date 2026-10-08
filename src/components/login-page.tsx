"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const MIN_PASSWORD_LENGTH = 8;

const INPUT =
  "block h-[29px] w-full rounded-sm border border-[#dee2e6] bg-white px-3 text-xs outline-none focus:border-[#86b7fe] focus:ring-2 focus:ring-[#0d6efd]/20";
const LABEL = "mb-1.5 block text-[11px] font-semibold";

/** Where to go after logging in: the page that sent you here, else the Dashboard. */
function nextPage(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

async function post(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? "Something went wrong. Please try again.");
  return result as { ok?: true; needsPassword?: true };
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex">
      <input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${INPUT} min-w-0 flex-1 rounded-r-none`}
      />
      <button
        type="button"
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow((s) => !s)}
        className="-ml-px flex h-[29px] w-[34px] items-center justify-center rounded-r-sm border border-[#dee2e6] bg-white text-[#495057] hover:bg-[#f1f3f5]"
      >
        {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </div>
  );
}

/** Front page: log in, or create your password the first time you log in. */
export function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"login" | "create">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetNote, setResetNote] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (step === "create") {
      if (password.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      if (password !== confirm) return setError("The two passwords don't match.");
    }
    setBusy(true);
    try {
      if (step === "login") {
        const result = await post("/api/auth/login", { username, password });
        if (result.needsPassword) {
          // First login for this account: ask for a password instead.
          setStep("create");
          setPassword("");
          setConfirm("");
          setBusy(false);
          return;
        }
      } else {
        await post("/api/auth/setup", { username, password });
      }
      router.replace(nextPage());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#212529]">
      <header className="flex h-[53px] shrink-0 items-center justify-center bg-gradient-to-r from-[#1b1b1e] to-[#2c2c31] shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
        <Image src="/truwater-logo.png" alt="Truwater" width={506} height={113} priority className="h-6 w-auto" />
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pt-[60px]">
        <form
          onSubmit={submit}
          className="w-full max-w-[292px] rounded-lg border border-[#dee2e6] bg-[#f7f8fa] px-5 pt-6 pb-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
        >
          <label htmlFor="login-username" className={LABEL}>
            Username
          </label>
          <input
            id="login-username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            readOnly={step === "create"}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={`${INPUT} mb-5 read-only:bg-[#e9ecef]`}
          />

          {step === "login" ? (
            <>
              <label htmlFor="login-password" className={LABEL}>
                Password
              </label>
              <PasswordInput id="login-password" value={password} onChange={setPassword} autoComplete="current-password" />
            </>
          ) : (
            <>
              <p className="mb-4 rounded-sm border border-[#b6d4fe] bg-[#e7f1ff] px-2.5 py-2 text-[11px] leading-snug text-[#084298]">
                First time here: create your password ({MIN_PASSWORD_LENGTH}+ characters). You&apos;ll use it to log in
                from now on.
              </p>
              <label htmlFor="new-password" className={LABEL}>
                New password
              </label>
              <PasswordInput id="new-password" value={password} onChange={setPassword} autoComplete="new-password" autoFocus />
              <label htmlFor="confirm-password" className={`${LABEL} mt-4`}>
                Confirm password
              </label>
              <PasswordInput id="confirm-password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            </>
          )}

          {error && (
            <p role="alert" className="mt-3 text-[11px] text-[#dc3545]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !username.trim()}
            className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-sm bg-[#36a94b] text-sm font-medium text-white transition-colors hover:bg-[#2f9541] disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {step === "login" ? "Login" : "Save password & log in"}
          </button>
          {step === "login" ? (
            <button
              type="button"
              onClick={() => setResetNote(true)}
              className="mx-auto mt-2 block text-[10px] font-medium text-[#3b82f6] hover:underline"
            >
              Forgot your password?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setStep("login");
                setPassword("");
                setConfirm("");
                setError(null);
              }}
              className="mx-auto mt-2 block text-[10px] font-medium text-[#3b82f6] hover:underline"
            >
              Back to login
            </button>
          )}
          {resetNote && step === "login" && (
            <p role="status" className="mt-1 text-center text-[10px] leading-snug text-[#6c757d]">
              Ask the master account (salesandre) to reset it. You&apos;ll then create a new one when you log in.
            </p>
          )}
        </form>

        <footer className="mt-12 text-[10px] text-[#212529]">{new Date().getFullYear()} © andremelos92-dev</footer>
      </main>
    </div>
  );
}

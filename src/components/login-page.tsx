"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

/**
 * Front page: the sign-in screen. Nothing is checked yet – Login simply opens the app. Real accounts and
 * passwords come later.
 */
export function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [resetNote, setResetNote] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#212529]">
      <header className="flex h-[53px] shrink-0 items-center justify-center bg-gradient-to-r from-[#1b1b1e] to-[#2c2c31] shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
        <Image src="/truwater-logo.png" alt="Truwater" width={506} height={113} priority className="h-6 w-auto" />
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pt-[60px]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            router.push("/dashboard");
          }}
          className="w-full max-w-[292px] rounded-lg border border-[#dee2e6] bg-[#f7f8fa] px-5 pt-6 pb-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
        >
          <label htmlFor="login-username" className="mb-1.5 block text-[11px] font-semibold">
            Username
          </label>
          <input
            id="login-username"
            type="text"
            autoComplete="username"
            className="mb-5 block h-[29px] w-full rounded-sm border border-[#dee2e6] bg-white px-3 text-xs outline-none focus:border-[#86b7fe] focus:ring-2 focus:ring-[#0d6efd]/20"
          />

          <label htmlFor="login-password" className="mb-1.5 block text-[11px] font-semibold">
            Password
          </label>
          <div className="mb-6 flex">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="block h-[29px] min-w-0 flex-1 rounded-l-sm border border-[#dee2e6] bg-white px-3 text-xs outline-none focus:border-[#86b7fe] focus:ring-2 focus:ring-[#0d6efd]/20"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((show) => !show)}
              className="-ml-px flex h-[29px] w-[34px] items-center justify-center rounded-r-sm border border-[#dee2e6] bg-white text-[#495057] hover:bg-[#f1f3f5]"
            >
              {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>

          <button
            type="submit"
            className="h-10 w-full rounded-sm bg-[#36a94b] text-sm font-medium text-white transition-colors hover:bg-[#2f9541]"
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setResetNote(true)}
            className="mx-auto mt-2 block text-[10px] font-medium text-[#3b82f6] hover:underline"
          >
            Forgot your password?
          </button>
          {resetNote && (
            <p role="status" className="mt-1 text-center text-[10px] text-[#6c757d]">
              Password reset will be available once logins are set up.
            </p>
          )}
        </form>

        <footer className="mt-12 text-[10px] text-[#212529]">{new Date().getFullYear()} © andremelos92-dev</footer>
      </main>
    </div>
  );
}

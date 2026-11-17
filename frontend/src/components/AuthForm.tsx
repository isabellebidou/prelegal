"use client";

import { useState, type FormEvent } from "react";
import type { User } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import styles from "./AuthForm.module.css";

type Mode = "signin" | "signup";

/** Sign in, or create an account, with email and password. */
export default function AuthForm({ onSuccess }: { onSuccess?: (user: User) => void }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const signingUp = mode === "signup";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const [name, email, password] = ["name", "email", "password"].map((k) => String(form.get(k) ?? ""));
    setError("");
    setPending(true);
    try {
      const user = signingUp ? await signUp(name, email, password) : await signIn(email, password);
      onSuccess?.(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  const switchTo = (next: Mode) => {
    setMode(next);
    setError("");
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.switcher} role="tablist" aria-label="Account">
        <button type="button" role="tab" aria-selected={!signingUp} onClick={() => switchTo("signin")}>
          Sign in
        </button>
        <button type="button" role="tab" aria-selected={signingUp} onClick={() => switchTo("signup")}>
          Create account
        </button>
      </div>

      {signingUp && (
        <label className={styles.field}>
          <span>Name</span>
          <input name="name" autoComplete="name" required maxLength={100} />
        </label>
      )}
      <label className={styles.field}>
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <div className={styles.field}>
        <label htmlFor="auth-password">Password</label>
        <input
          id="auth-password"
          name="password"
          type="password"
          autoComplete={signingUp ? "new-password" : "current-password"}
          required
          minLength={signingUp ? 8 : undefined}
          maxLength={72}
          aria-describedby={signingUp ? "auth-password-hint" : undefined}
        />
        {signingUp && <small id="auth-password-hint">At least 8 characters.</small>}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Please wait..." : signingUp ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import styles from "./SignIn.module.css";

/**
 * Placeholder sign-in screen. There is no authentication yet: any name and
 * email go straight to the app, and nothing is sent to the backend.
 */
export default function SignIn() {
  const router = useRouter();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push("/nda/");
  };

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1>Prelegal</h1>
        <p className={styles.intro}>Sign in to draft your legal agreements.</p>

        <label className={styles.field}>
          <span>Name</span>
          <input name="name" autoComplete="name" required />
        </label>
        <label className={styles.field}>
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>

        <button type="submit" className={styles.submit}>
          Sign in
        </button>
        <p className={styles.note}>Demo only: no account or password is needed yet.</p>
      </form>
    </main>
  );
}

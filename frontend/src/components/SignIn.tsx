"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthForm from "./AuthForm";
import { useAuth } from "./AuthProvider";
import styles from "./SignIn.module.css";

const POINTS = [
  "Describe what you need; the AI picks the right agreement and fills it in",
  "11 Common Paper standard agreements, from NDAs to DPAs",
  "Download a PDF anytime, or save drafts to your account",
];

/** Landing page: sign in or create an account, or start drafting as a guest. */
export default function SignIn() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <main className={styles.page}>
      <section className={styles.pitch}>
        <p className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          Prelegal
        </p>
        <h1>Draft legal agreements in minutes.</h1>
        <ul>
          {POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p className={styles.fineprint}>
          Every document is a draft and should be reviewed by a qualified lawyer before use.
        </p>
      </section>

      <section className={styles.panel}>
        <div className={styles.card}>
          {user ? (
            <>
              <h2>Welcome back, {user.name}</h2>
              <Link href="/create/" className={styles.primary}>
                Go to your documents
              </Link>
            </>
          ) : (
            <>
              <h2>Welcome</h2>
              <AuthForm onSuccess={() => router.push("/create/")} />
              <p className={styles.or}>or</p>
              <Link href="/create/" className={styles.guest}>
                Continue as guest
              </Link>
              <p className={styles.note}>Guests can draft and download. Sign in to save documents.</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

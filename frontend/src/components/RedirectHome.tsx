"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** For old addresses: the app now lives at the home page. */
export default function RedirectHome() {
  const router = useRouter();
  useEffect(() => router.replace("/"), [router]);
  return (
    <p>
      Moved to <Link href="/">Prelegal</Link>.
    </p>
  );
}

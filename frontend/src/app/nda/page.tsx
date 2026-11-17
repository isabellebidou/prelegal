"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** The NDA creator moved to /create, which handles every document type. */
export default function NdaPage() {
  const router = useRouter();
  useEffect(() => router.replace("/create/"), [router]);
  return (
    <p>
      Moved to <a href="/create/">the document creator</a>.
    </p>
  );
}

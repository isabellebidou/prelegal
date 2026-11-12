import type { Metadata } from "next";
import SignIn from "@/components/SignIn";

export const metadata: Metadata = {
  title: "Sign in | Prelegal",
};

export default function Home() {
  return <SignIn />;
}

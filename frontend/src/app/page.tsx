import type { Metadata } from "next";
import DocumentCreator from "@/components/DocumentCreator";
import { loadTemplates } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Prelegal | Draft legal agreements with AI",
  description:
    "Draft a Common Paper agreement by chatting with AI, then download the completed document.",
};

export default function Home() {
  return <DocumentCreator templates={loadTemplates()} />;
}

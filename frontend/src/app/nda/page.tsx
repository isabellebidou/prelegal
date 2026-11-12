import type { Metadata } from "next";
import NdaCreator from "@/components/NdaCreator";
import { loadMutualNdaTemplates } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Mutual NDA Creator | Prelegal",
  description:
    "Fill in the key terms of a Common Paper Mutual NDA and download the completed agreement.",
};

export default function NdaPage() {
  const { coverPage, standardTerms } = loadMutualNdaTemplates();
  return <NdaCreator coverPageTemplate={coverPage} standardTerms={standardTerms} />;
}

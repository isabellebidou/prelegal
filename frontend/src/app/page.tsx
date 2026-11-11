import NdaCreator from "@/components/NdaCreator";
import { loadMutualNdaTemplates } from "@/lib/templates";

export default function Home() {
  const { coverPage, standardTerms } = loadMutualNdaTemplates();
  return <NdaCreator coverPageTemplate={coverPage} standardTerms={standardTerms} />;
}

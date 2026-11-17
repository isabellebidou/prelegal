import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { DocumentType } from "./documents";

/** The repository's templates/ directory, alongside frontend/. */
const TEMPLATES_DIR = path.join(process.cwd(), "..", "templates");

function readTemplate(filename: string): string {
  return fs.readFileSync(path.join(TEMPLATES_DIR, filename), "utf-8");
}

export interface Templates {
  documents: DocumentType[];
  /** Standard terms markdown by document id. */
  standardTerms: Record<string, string>;
  ndaCoverPage: string;
}

/**
 * Reads the document registry and every template. Synchronous file reads are
 * resolved while prerendering, so the templates are baked into the static page.
 */
export function loadTemplates(): Templates {
  const documents: DocumentType[] = JSON.parse(readTemplate("documents.json")).documents;
  return {
    documents,
    standardTerms: Object.fromEntries(documents.map((d) => [d.id, readTemplate(d.template)])),
    ndaCoverPage: readTemplate("Mutual-NDA-coverpage.md"),
  };
}

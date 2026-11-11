import "server-only";
import fs from "node:fs";
import path from "node:path";

/** The repository's templates/ directory, alongside frontend/. */
const TEMPLATES_DIR = path.join(process.cwd(), "..", "templates");

function readTemplate(filename: string): string {
  return fs.readFileSync(path.join(TEMPLATES_DIR, filename), "utf-8");
}

export interface MutualNdaTemplates {
  coverPage: string;
  standardTerms: string;
}

/**
 * Reads the Common Paper Mutual NDA templates. Synchronous file reads are
 * resolved while prerendering, so the templates are baked into the static page.
 */
export function loadMutualNdaTemplates(): MutualNdaTemplates {
  return {
    coverPage: readTemplate("Mutual-NDA-coverpage.md"),
    standardTerms: readTemplate("Mutual-NDA.md"),
  };
}

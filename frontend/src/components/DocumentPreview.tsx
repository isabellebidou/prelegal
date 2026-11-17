import type { ReactNode } from "react";
import Markdown from "./Markdown";
import styles from "./DocumentPreview.module.css";

export const DISCLAIMER =
  "Every document Prelegal generates is a draft. Have it reviewed by a qualified lawyer before you sign or rely on it.";

interface DocumentPreviewProps {
  coverPage: ReactNode;
  standardTerms: string;
}

/** The agreement as it will be printed: the cover page, then the standard terms. */
export default function DocumentPreview({ coverPage, standardTerms }: DocumentPreviewProps) {
  return (
    <article className={styles.document}>
      <p className={styles.draftNotice}>Draft: subject to legal review before use.</p>
      <section>{coverPage}</section>
      <section className={styles.standardTerms}>
        <Markdown>{standardTerms}</Markdown>
      </section>
    </article>
  );
}

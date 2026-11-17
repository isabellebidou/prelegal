import type { ReactNode } from "react";
import Markdown from "./Markdown";
import styles from "./DocumentPreview.module.css";

interface DocumentPreviewProps {
  coverPage: ReactNode;
  standardTerms: string;
}

/** The agreement as it will be printed: the cover page, then the standard terms. */
export default function DocumentPreview({ coverPage, standardTerms }: DocumentPreviewProps) {
  return (
    <article className={styles.document}>
      <section>{coverPage}</section>
      <section className={styles.standardTerms}>
        <Markdown>{standardTerms}</Markdown>
      </section>
    </article>
  );
}

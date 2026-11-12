"use client";

import { useState, useSyncExternalStore } from "react";
import {
  defaultNdaFormValues,
  documentTitle,
  fillCoverPage,
  type NdaFormValues,
} from "@/lib/nda";
import NdaDocument from "./NdaDocument";
import NdaForm from "./NdaForm";
import styles from "./NdaCreator.module.css";

/** Today's date as YYYY-MM-DD in the user's local time zone. */
function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const noopSubscribe = () => () => {};

/**
 * Today's date in the browser; "" while prerendering, so the static page
 * never bakes in the build date.
 */
function useToday(): string {
  return useSyncExternalStore(noopSubscribe, localToday, () => "");
}

interface NdaCreatorProps {
  coverPageTemplate: string;
  standardTerms: string;
}

export default function NdaCreator({ coverPageTemplate, standardTerms }: NdaCreatorProps) {
  const [values, setValues] = useState<NdaFormValues>(defaultNdaFormValues);
  const today = useToday();

  // The effective date shows today until the user picks one. Only the fields
  // the user edits are stored, so the default never gets frozen into state.
  const resolvedValues = { ...values, effectiveDate: values.effectiveDate || today };
  const coverPage = fillCoverPage(coverPageTemplate, resolvedValues);

  const updateValues = (changes: Partial<NdaFormValues>) =>
    setValues((prev) => ({ ...prev, ...changes }));

  const downloadPdf = () => {
    // Browsers use the document title as the default PDF file name. Some
    // browsers return from print() before reading it, so restore it only
    // once printing has finished.
    const previousTitle = document.title;
    const restoreTitle = () => {
      document.title = previousTitle;
    };
    document.title = documentTitle(resolvedValues);
    window.addEventListener("afterprint", restoreTitle, { once: true });
    window.print();
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <header className={styles.header}>
          <h1>Mutual NDA Creator</h1>
          <p>
            Fill in the details below. The agreement updates as you type; download
            it as a PDF when you&apos;re done.
          </p>
        </header>
        <NdaForm values={resolvedValues} onChange={updateValues} />
      </aside>

      <main className={styles.preview}>
        <div className={styles.toolbar}>
          <span>Preview</span>
          <button type="button" className={styles.download} onClick={downloadPdf}>
            Download PDF
          </button>
        </div>
        <NdaDocument coverPage={coverPage} standardTerms={standardTerms} />
      </main>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  defaultNdaFormValues,
  documentTitle,
  fillCoverPage,
  isComplete,
  type NdaFormValues,
} from "@/lib/nda";
import Chat from "./Chat";
import NdaDocument from "./NdaDocument";
import NdaForm from "./NdaForm";
import styles from "./NdaCreator.module.css";

const TABS = [
  { id: "chat", label: "Chat" },
  { id: "form", label: "Edit fields" },
] as const;

type Tab = (typeof TABS)[number]["id"];

interface NdaCreatorProps {
  coverPageTemplate: string;
  standardTerms: string;
}

export default function NdaCreator({ coverPageTemplate, standardTerms }: NdaCreatorProps) {
  const [values, setValues] = useState<NdaFormValues>(defaultNdaFormValues);
  const [tab, setTab] = useState<Tab>("chat");
  const coverPage = fillCoverPage(coverPageTemplate, values);
  const complete = isComplete(values);

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
    document.title = documentTitle(values);
    window.addEventListener("afterprint", restoreTitle, { once: true });
    window.print();
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <header className={styles.header}>
          <h1>Mutual NDA Creator</h1>
          <p>
            Chat with the AI to fill in the agreement, or edit the fields directly. The
            preview updates as you go.
          </p>
        </header>

        <div className={styles.tabs} role="tablist">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-controls={`panel-${id}`}
              aria-selected={tab === id}
              className={styles.tab}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Both panels stay mounted so the conversation survives switching tabs. */}
        <div
          role="tabpanel"
          id="panel-chat"
          aria-labelledby="tab-chat"
          className={styles.chatPanel}
          hidden={tab !== "chat"}
        >
          <Chat values={values} onFieldsChange={setValues} />
        </div>
        <div role="tabpanel" id="panel-form" aria-labelledby="tab-form" hidden={tab !== "form"}>
          <NdaForm values={values} onChange={updateValues} />
        </div>
      </aside>

      <main className={styles.preview}>
        <div className={styles.toolbar}>
          <span>Preview</span>
          {complete ? (
            <button type="button" className={styles.download} onClick={downloadPdf}>
              Download PDF
            </button>
          ) : (
            <span>Download is available once all details are filled in</span>
          )}
        </div>
        <NdaDocument coverPage={coverPage} standardTerms={standardTerms} />
      </main>
    </div>
  );
}

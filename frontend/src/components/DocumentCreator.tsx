"use client";

import { useState } from "react";
import {
  defaultValues,
  isComplete,
  NDA_ID,
  NO_DOCUMENT,
  type DocumentState,
  type DocumentType,
  type GenericValues,
} from "@/lib/documents";
import { fillCoverPage, type NdaFormValues } from "@/lib/nda";
import { documentTitle } from "@/lib/parties";
import type { Templates } from "@/lib/templates";
import Chat from "./Chat";
import CoverPage from "./CoverPage";
import DocumentPreview from "./DocumentPreview";
import Field from "./Field";
import GenericForm from "./GenericForm";
import Markdown from "./Markdown";
import NdaForm from "./NdaForm";
import styles from "./DocumentCreator.module.css";
import formStyles from "./Form.module.css";
import previewStyles from "./DocumentPreview.module.css";

const TABS = [
  { id: "chat", label: "Chat" },
  { id: "form", label: "Edit fields" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function Preview({ doc, state, templates }: { doc: DocumentType; state: DocumentState; templates: Templates }) {
  const coverPage =
    doc.id === NDA_ID ? (
      <Markdown>{fillCoverPage(templates.ndaCoverPage, state.values as NdaFormValues)}</Markdown>
    ) : (
      <CoverPage doc={doc} values={state.values as GenericValues} />
    );
  return <DocumentPreview coverPage={coverPage} standardTerms={templates.standardTerms[doc.id]} />;
}

export default function DocumentCreator({ templates }: { templates: Templates }) {
  const [state, setState] = useState<DocumentState>(NO_DOCUMENT);
  const [tab, setTab] = useState<Tab>("chat");
  const doc = templates.documents.find((d) => d.id === state.type);
  const complete = doc !== undefined && state.values !== null && isComplete(doc, state.values);

  const chooseType = (id: string) => {
    const chosen = templates.documents.find((d) => d.id === id);
    setState(chosen ? { type: chosen.id, values: defaultValues(chosen) } : NO_DOCUMENT);
  };

  const updateValues = (changes: object) =>
    setState((prev) => (prev.type === null ? prev : { ...prev, values: { ...prev.values, ...changes } }));

  const downloadPdf = () => {
    if (!doc || !state.values) return;
    // Browsers use the document title as the default PDF file name. Some
    // browsers return from print() before reading it, so restore it only
    // once printing has finished.
    const previousTitle = document.title;
    const restoreTitle = () => {
      document.title = previousTitle;
    };
    document.title = documentTitle(doc.shortName, state.values);
    window.addEventListener("afterprint", restoreTitle, { once: true });
    window.print();
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <header className={styles.header}>
          <h1>{doc ? `${doc.shortName} Creator` : "Document Creator"}</h1>
          <p>
            Chat with the AI to choose and fill in your agreement, or edit the fields directly.
            The preview updates as you go.
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
          <Chat state={state} onStateChange={setState} />
        </div>
        <div role="tabpanel" id="panel-form" aria-labelledby="tab-form" hidden={tab !== "form"}>
          <div className={`${formStyles.form} ${styles.typePicker}`}>
            <Field label="Document type">
              <select value={state.type ?? ""} onChange={(e) => chooseType(e.target.value)}>
                <option value="">Choose a document...</option>
                {templates.documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {doc && state.values && doc.id === NDA_ID && (
            <NdaForm values={state.values as NdaFormValues} onChange={updateValues} />
          )}
          {doc && state.values && doc.id !== NDA_ID && (
            <GenericForm doc={doc} values={state.values as GenericValues} onChange={updateValues} />
          )}
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
            doc && <span>Download is available once all details are filled in</span>
          )}
        </div>
        {doc ? (
          <Preview doc={doc} state={state} templates={templates} />
        ) : (
          <article className={`${previewStyles.document} ${previewStyles.empty}`}>
            Tell the AI what agreement you need, or choose a document type under Edit fields.
            Your document will appear here.
          </article>
        )}
      </main>
    </div>
  );
}

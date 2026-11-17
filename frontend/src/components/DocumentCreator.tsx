"use client";

import { useState } from "react";
import { getDocument, saveDocument, type ChatMessage, type User } from "@/lib/api";
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
import { snapshot, type Draft } from "@/lib/session";
import type { Templates } from "@/lib/templates";
import AppHeader from "./AppHeader";
import AuthForm from "./AuthForm";
import { useAuth } from "./AuthProvider";
import Chat from "./Chat";
import CoverPage from "./CoverPage";
import DocumentPreview, { DISCLAIMER } from "./DocumentPreview";
import DocumentsModal from "./DocumentsModal";
import Field from "./Field";
import GenericForm from "./GenericForm";
import Markdown from "./Markdown";
import Modal from "./Modal";
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

type Dialog = "signin" | "documents" | null;

export default function DocumentCreator({ templates }: { templates: Templates }) {
  const { user } = useAuth();
  const [state, setState] = useState<DocumentState>(NO_DOCUMENT);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // A new key starts a new conversation (New document, or opening a saved one).
  const [chatKey, setChatKey] = useState(0);
  const [tab, setTab] = useState<Tab>("chat");
  // The saved copy: its id, the account it belongs to and what was last saved.
  const [saved, setSaved] = useState<{ id: number; userId: number; snapshot: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  // Whether the sign-in dialog was opened by Save (so it saves once signed in).
  const [savingAfterSignIn, setSavingAfterSignIn] = useState(false);

  const doc = templates.documents.find((d) => d.id === state.type);
  const complete = doc !== undefined && state.values !== null && isComplete(doc, state.values);
  const draft: Draft = { document: state, messages };
  // A saved copy only counts for the account that saved it (not after sign out).
  const savedCopy = saved && user && saved.userId === user.id ? saved : null;
  const savedId = savedCopy?.id;
  const unsaved = savedCopy?.snapshot !== snapshot(draft);
  const hasWork = state.type !== null || messages.some((m) => m.role === "user");

  const startDraft = (next: Draft, savedFor?: { id: number; userId: number }) => {
    setState(next.document);
    setMessages(next.messages);
    setChatKey((key) => key + 1);
    setSaved(savedFor ? { ...savedFor, snapshot: snapshot(next) } : null);
    setNotice("");
  };

  const confirmDiscard = () =>
    !hasWork || !unsaved || window.confirm("Discard your unsaved changes to this document?");

  const newDocument = () => {
    if (confirmDiscard()) startDraft({ document: NO_DOCUMENT, messages: [] });
  };

  const openDocument = async (id: number) => {
    if (id !== savedId && !confirmDiscard()) return;
    setDialog(null);
    try {
      const opened = await getDocument(id);
      startDraft(
        { document: { type: opened.documentType, values: opened.fields }, messages: opened.messages },
        { id: opened.id, userId: user!.id },
      );
    } catch (err) {
      setNotice((err as Error).message);
    }
  };

  /** Saves to the signed-in account; `as` is the user who has just signed in. */
  const save = async (as: User | null | undefined = user) => {
    if (!doc || !state.values) return;
    if (!as) {
      setSavingAfterSignIn(true);
      setDialog("signin");
      return;
    }
    const saving = draft;
    setSaving(true);
    setNotice("");
    try {
      // Update the saved copy if this account owns it; otherwise save a new one.
      const ownId = saved?.userId === as.id ? saved.id : undefined;
      const result = await saveDocument(
        {
          documentType: doc.id,
          title: documentTitle(doc.shortName, state.values),
          fields: state.values,
          messages,
        },
        ownId,
      );
      setSaved({ id: result.id, userId: as.id, snapshot: snapshot(saving) });
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setSaving(false);
    }
  };


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
    <>
      <AppHeader
        onNewDocument={newDocument}
        onMyDocuments={() => setDialog("documents")}
        onSignIn={() => setDialog("signin")}
      />
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
            <Chat
              key={chatKey}
              state={state}
              onStateChange={setState}
              messages={messages}
              onMessagesChange={setMessages}
            />
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
          <p className={styles.disclaimer} role="note">
            {DISCLAIMER}
          </p>
          <div className={styles.toolbar}>
            <span className={styles.status} aria-live="polite">
              {notice ? (
                <span className={styles.notice}>{notice}</span>
              ) : saving ? (
                "Saving..."
              ) : savedId !== undefined ? (
                unsaved ? "Unsaved changes" : "Saved"
              ) : (
                "Preview"
              )}
            </span>
            <div className={styles.buttons}>
              {doc && (
                <button
                  type="button"
                  className={styles.save}
                  onClick={() => save()}
                  disabled={saving || user === undefined || (savedId !== undefined && !unsaved)}
                >
                  Save
                </button>
              )}
              {complete ? (
                <button type="button" className={styles.download} onClick={downloadPdf}>
                  Download PDF
                </button>
              ) : (
                doc && <span className={styles.hintText}>Download is available once all details are filled in</span>
              )}
            </div>
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

      {dialog === "signin" && (
        <Modal
          title={savingAfterSignIn ? "Sign in to save your document" : "Sign in"}
          onClose={() => {
            setDialog(null);
            setSavingAfterSignIn(false);
          }}
        >
          <AuthForm
            onSuccess={(signedIn) => {
              setDialog(null);
              if (savingAfterSignIn) {
                setSavingAfterSignIn(false);
                void save(signedIn);
              }
            }}
          />
        </Modal>
      )}
      {dialog === "documents" && (
        <DocumentsModal
          documents={templates.documents}
          currentId={savedId}
          onOpen={openDocument}
          onDeleted={(id) => {
            if (id === savedId) setSaved(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

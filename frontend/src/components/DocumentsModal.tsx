"use client";

import { useEffect, useState } from "react";
import { deleteDocument, listDocuments, type DocumentSummary } from "@/lib/api";
import type { DocumentType } from "@/lib/documents";
import { formatSavedAt } from "@/lib/session";
import Modal from "./Modal";
import styles from "./DocumentsModal.module.css";

interface DocumentsModalProps {
  documents: DocumentType[];
  /** The id of the document open in the editor, if saved. */
  currentId?: number;
  onOpen: (id: number) => void;
  /** Called after a document is deleted. */
  onDeleted: (id: number) => void;
  onClose: () => void;
}

/** The signed-in user's saved documents: open or delete them. */
export default function DocumentsModal({ documents, currentId, onOpen, onDeleted, onClose }: DocumentsModalProps) {
  const [saved, setSaved] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listDocuments()
      .then(setSaved)
      .catch((err: Error) => setError(err.message));
  }, []);

  const remove = async (doc: DocumentSummary) => {
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      await deleteDocument(doc.id);
      setSaved((list) => list?.filter((d) => d.id !== doc.id) ?? null);
      onDeleted(doc.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const typeName = (id: string) => documents.find((d) => d.id === id)?.name ?? id;

  return (
    <Modal title="My documents" onClose={onClose}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {saved === null && !error && <p className={styles.note}>Loading...</p>}
      {saved?.length === 0 && (
        <p className={styles.note}>No saved documents yet. Use Save to keep a draft here.</p>
      )}
      {saved && saved.length > 0 && (
        <ul className={styles.list} aria-label="Saved documents">
          {saved.map((doc) => (
            <li key={doc.id} className={styles.item}>
              <button type="button" className={styles.open} onClick={() => onOpen(doc.id)}>
                <strong>{doc.title}</strong>
                <span>
                  {typeName(doc.documentType)} · Saved {formatSavedAt(doc.updatedAt)}
                  {doc.id === currentId && " · Open now"}
                </span>
              </button>
              <button
                type="button"
                className={styles.delete}
                aria-label={`Delete ${doc.title}`}
                onClick={() => remove(doc)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

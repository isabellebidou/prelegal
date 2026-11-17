"use client";

import type { DocumentType, GenericValues } from "@/lib/documents";
import Field from "./Field";
import PartyFieldset from "./PartyFieldset";
import styles from "./Form.module.css";

interface GenericFormProps {
  doc: DocumentType;
  values: GenericValues;
  /** Receives only the parts that changed. */
  onChange: (changes: Partial<GenericValues>) => void;
}

/** Edits a document's key terms and parties, as listed in its registry entry. */
export default function GenericForm({ doc, values, onChange }: GenericFormProps) {
  const setTerm = (key: string, value: string) =>
    onChange({ terms: { ...values.terms, [key]: value } });

  return (
    <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
      <fieldset className={styles.group}>
        <legend>Key terms</legend>
        {(doc.fields ?? []).map((field) => {
          const props = {
            value: values.terms[field.key] ?? "",
            onChange: (e: { target: { value: string } }) => setTerm(field.key, e.target.value),
          };
          const label = field.optional ? `${field.label} (optional)` : field.label;
          return (
            <Field key={field.key} label={label} hint={field.description}>
              {field.kind === "longtext" ? (
                <textarea rows={3} {...props} />
              ) : (
                <input type={field.kind === "date" ? "date" : "text"} {...props} />
              )}
            </Field>
          );
        })}
      </fieldset>

      <PartyFieldset
        heading={doc.parties[0]}
        party={values.party1}
        onChange={(party1) => onChange({ party1 })}
      />
      <PartyFieldset
        heading={doc.parties[1]}
        party={values.party2}
        onChange={(party2) => onChange({ party2 })}
      />
    </form>
  );
}

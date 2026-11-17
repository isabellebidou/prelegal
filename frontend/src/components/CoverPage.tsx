import { termText, type DocumentType, type GenericValues } from "@/lib/documents";
import { coverLayout } from "@/lib/coverLayouts";
import type { PartyDetails } from "@/lib/parties";
import styles from "./DocumentPreview.module.css";

/** A filled value, or the term's name in brackets until it is filled. */
function Value({ text, placeholder }: { text: string; placeholder: string }) {
  return text ? (
    <p className={styles.value}>{text}</p>
  ) : (
    <p className={styles.placeholder}>[{placeholder}]</p>
  );
}

const SIGNATURE_ROWS: [string, keyof PartyDetails | null][] = [
  ["Signature", null],
  ["Print Name", "name"],
  ["Title", "title"],
  ["Company", "company"],
  ["Notice Address", "noticeAddress"],
  ["Date", null],
];

function SignatureTable({ parties, values }: { parties: [string, string]; values: GenericValues }) {
  return (
    <table>
      <thead>
        <tr>
          <th />
          <th>{parties[0].toUpperCase()}</th>
          <th>{parties[1].toUpperCase()}</th>
        </tr>
      </thead>
      <tbody>
        {SIGNATURE_ROWS.map(([label, key]) => (
          <tr key={label}>
            <td>
              {label}
              {key === "noticeAddress" && (
                <span className={styles.hint}>Use either email or postal address</span>
              )}
            </td>
            <td className={styles.value}>{key && values.party1[key]}</td>
            <td className={styles.value}>{key && values.party2[key]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Cover page for every document except the Mutual NDA, built from its layout. */
export default function CoverPage({ doc, values }: { doc: DocumentType; values: GenericValues }) {
  const { intro, sections } = coverLayout(doc);
  const fields = new Map((doc.fields ?? []).map((f) => [f.key, f]));

  return (
    <>
      <h1>{doc.name}</h1>
      <p>{intro}</p>
      {sections.map((section) => (
        <div key={section.heading}>
          <h2>{section.heading.toUpperCase()}</h2>
          {section.keys.map((key) => {
            const field = fields.get(key)!;
            return (
              <div key={key}>
                <h3>{field.label}</h3>
                <span className={styles.hint}>
                  {field.description}
                  {field.optional && " (optional)"}
                </span>
                <Value
                  text={termText(field, values.terms[key]) || (field.optional ? "None." : "")}
                  placeholder={`Fill in ${field.label}`}
                />
              </div>
            );
          })}
        </div>
      ))}
      <p>
        By signing this Cover Page, each party agrees to enter into this {doc.name} as of the
        Effective Date.
      </p>
      <SignatureTable parties={doc.parties} values={values} />
    </>
  );
}

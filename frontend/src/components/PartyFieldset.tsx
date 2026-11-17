import type { PartyDetails } from "@/lib/parties";
import Field from "./Field";
import styles from "./Form.module.css";

interface PartyFieldsetProps {
  heading: string;
  party: PartyDetails;
  onChange: (party: PartyDetails) => void;
}

/** Signatory details for one party. */
export default function PartyFieldset({ heading, party, onChange }: PartyFieldsetProps) {
  const set = (key: keyof PartyDetails, value: string) => onChange({ ...party, [key]: value });
  return (
    <fieldset className={styles.group}>
      <legend>{heading}</legend>
      <Field label="Company">
        <input
          value={party.company}
          onChange={(e) => set("company", e.target.value)}
          autoComplete="organization"
        />
      </Field>
      <Field label="Signatory name">
        <input value={party.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
      </Field>
      <Field label="Title">
        <input
          value={party.title}
          onChange={(e) => set("title", e.target.value)}
          autoComplete="organization-title"
        />
      </Field>
      <Field label="Notice address" hint="Email or postal address">
        <textarea
          rows={2}
          value={party.noticeAddress}
          onChange={(e) => set("noticeAddress", e.target.value)}
        />
      </Field>
    </fieldset>
  );
}

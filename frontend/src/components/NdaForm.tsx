"use client";

import type { NdaFormValues, TermUnit } from "@/lib/nda";
import Field from "./Field";
import PartyFieldset from "./PartyFieldset";
import styles from "./Form.module.css";

interface NdaFormProps {
  values: NdaFormValues;
  /** Receives only the fields that changed. */
  onChange: (changes: Partial<NdaFormValues>) => void;
}

/** A whole-number length with a months/years unit, e.g. 18 months. */
function TermLength({
  name,
  length,
  unit,
  disabled,
  onLength,
  onUnit,
}: {
  name: string;
  length: string;
  unit: TermUnit;
  disabled: boolean;
  onLength: (length: string) => void;
  onUnit: (unit: TermUnit) => void;
}) {
  return (
    <>
      <input
        type="number"
        min={0}
        step="any"
        className={styles.years}
        aria-label={`${name} length`}
        value={length}
        onChange={(e) => onLength(e.target.value)}
        disabled={disabled}
      />
      <select
        aria-label={`${name} unit`}
        value={unit}
        onChange={(e) => onUnit(e.target.value as TermUnit)}
        disabled={disabled}
      >
        <option value="months">month(s)</option>
        <option value="years">year(s)</option>
      </select>
    </>
  );
}

export default function NdaForm({ values, onChange }: NdaFormProps) {
  const set = <K extends keyof NdaFormValues>(key: K, value: NdaFormValues[K]) =>
    onChange({ [key]: value });

  return (
    <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
      <fieldset className={styles.group}>
        <legend>Agreement</legend>
        <Field label="Purpose" hint="How Confidential Information may be used">
          <textarea
            rows={3}
            value={values.purpose}
            onChange={(e) => set("purpose", e.target.value)}
          />
        </Field>
        <Field label="Effective date">
          <input
            type="date"
            value={values.effectiveDate}
            onChange={(e) => set("effectiveDate", e.target.value)}
          />
        </Field>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>MNDA term</legend>
        <label className={styles.choice}>
          <input
            type="radio"
            name="mndaTermType"
            checked={values.mndaTermType === "expires"}
            onChange={() => set("mndaTermType", "expires")}
          />
          Expires after
        </label>
        <div className={styles.term}>
          <TermLength
            name="MNDA term"
            length={values.mndaTermLength}
            unit={values.mndaTermUnit}
            disabled={values.mndaTermType !== "expires"}
            onLength={(v) => set("mndaTermLength", v)}
            onUnit={(v) => set("mndaTermUnit", v)}
          />
        </div>
        <label className={styles.choice}>
          <input
            type="radio"
            name="mndaTermType"
            checked={values.mndaTermType === "untilTerminated"}
            onChange={() => set("mndaTermType", "untilTerminated")}
          />
          Continues until terminated
        </label>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Term of confidentiality</legend>
        <label className={styles.choice}>
          <input
            type="radio"
            name="confidentialityTermType"
            checked={values.confidentialityTermType === "fixed"}
            onChange={() => set("confidentialityTermType", "fixed")}
          />
          Fixed length from the effective date
        </label>
        <div className={styles.term}>
          <TermLength
            name="Term of confidentiality"
            length={values.confidentialityTermLength}
            unit={values.confidentialityTermUnit}
            disabled={values.confidentialityTermType !== "fixed"}
            onLength={(v) => set("confidentialityTermLength", v)}
            onUnit={(v) => set("confidentialityTermUnit", v)}
          />
        </div>
        <label className={styles.choice}>
          <input
            type="radio"
            name="confidentialityTermType"
            checked={values.confidentialityTermType === "perpetual"}
            onChange={() => set("confidentialityTermType", "perpetual")}
          />
          In perpetuity
        </label>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Governing law &amp; jurisdiction</legend>
        <Field label="Governing law" hint="State, e.g. Delaware">
          <input
            value={values.governingLaw}
            onChange={(e) => set("governingLaw", e.target.value)}
          />
        </Field>
        <Field label="Jurisdiction" hint="City or county and state, e.g. New Castle, DE">
          <input
            value={values.jurisdiction}
            onChange={(e) => set("jurisdiction", e.target.value)}
          />
        </Field>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>MNDA modifications</legend>
        <Field label="Modifications" hint="Optional changes to the standard terms">
          <textarea
            rows={3}
            value={values.modifications}
            onChange={(e) => set("modifications", e.target.value)}
          />
        </Field>
      </fieldset>

      <PartyFieldset
        heading="Party 1"
        party={values.party1}
        onChange={(party1) => set("party1", party1)}
      />
      <PartyFieldset
        heading="Party 2"
        party={values.party2}
        onChange={(party2) => set("party2", party2)}
      />
    </form>
  );
}

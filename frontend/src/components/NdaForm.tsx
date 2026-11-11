"use client";

import type { ReactNode } from "react";
import type { NdaFormValues, PartyDetails } from "@/lib/nda";
import styles from "./NdaForm.module.css";

interface NdaFormProps {
  values: NdaFormValues;
  /** Receives only the fields that changed. */
  onChange: (changes: Partial<NdaFormValues>) => void;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
      {children}
    </label>
  );
}

export default function NdaForm({ values, onChange }: NdaFormProps) {
  const set = <K extends keyof NdaFormValues>(key: K, value: NdaFormValues[K]) =>
    onChange({ [key]: value });

  const setParty = (
    party: "party1" | "party2",
    key: keyof PartyDetails,
    value: string,
  ) => set(party, { ...values[party], [key]: value });

  const partyFields = (party: "party1" | "party2", heading: string) => (
    <fieldset className={styles.group}>
      <legend>{heading}</legend>
      <Field label="Company">
        <input
          value={values[party].company}
          onChange={(e) => setParty(party, "company", e.target.value)}
          autoComplete="organization"
        />
      </Field>
      <Field label="Signatory name">
        <input
          value={values[party].name}
          onChange={(e) => setParty(party, "name", e.target.value)}
          autoComplete="name"
        />
      </Field>
      <Field label="Title">
        <input
          value={values[party].title}
          onChange={(e) => setParty(party, "title", e.target.value)}
          autoComplete="organization-title"
        />
      </Field>
      <Field label="Notice address" hint="Email or postal address">
        <textarea
          rows={2}
          value={values[party].noticeAddress}
          onChange={(e) => setParty(party, "noticeAddress", e.target.value)}
        />
      </Field>
    </fieldset>
  );

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
          <input
            type="number"
            min={1}
            className={styles.years}
            aria-label="MNDA term in years"
            value={values.mndaTermYears}
            onChange={(e) => set("mndaTermYears", e.target.value)}
            disabled={values.mndaTermType !== "expires"}
          />
          year(s)
        </label>
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
            checked={values.confidentialityTermType === "years"}
            onChange={() => set("confidentialityTermType", "years")}
          />
          <input
            type="number"
            min={1}
            className={styles.years}
            aria-label="Term of confidentiality in years"
            value={values.confidentialityTermYears}
            onChange={(e) => set("confidentialityTermYears", e.target.value)}
            disabled={values.confidentialityTermType !== "years"}
          />
          year(s) from the effective date
        </label>
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

      {partyFields("party1", "Party 1")}
      {partyFields("party2", "Party 2")}
    </form>
  );
}

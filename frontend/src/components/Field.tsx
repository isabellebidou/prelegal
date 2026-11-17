import { cloneElement, useId, type ReactElement } from "react";
import styles from "./Form.module.css";

type FieldControl = ReactElement<{ id?: string; "aria-describedby"?: string }>;

/** A labelled control; the hint is its accessible description, not its name. */
export default function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: FieldControl;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {hint && (
        <span id={hintId} className={styles.hint}>
          {hint}
        </span>
      )}
      {cloneElement(children, { id, "aria-describedby": hint ? hintId : undefined })}
    </div>
  );
}

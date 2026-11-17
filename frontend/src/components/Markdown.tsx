import ReactMarkdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import styles from "./DocumentPreview.module.css";

/**
 * The templates contain a little inline HTML: <label> hints on the NDA cover
 * page and <span class="..._link"> references to cover page terms in the
 * standard terms. Allow those (and checked task-list boxes) on top of the
 * default safe schema.
 */
const LINK_CLASSES = ["coverpage_link", "orderform_link", "keyterms_link", "businessterms_link"];

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "label"],
  attributes: {
    ...defaultSchema.attributes,
    input: [...(defaultSchema.attributes?.input ?? []), "checked"],
    span: [...(defaultSchema.attributes?.span ?? []), ["className", ...LINK_CLASSES]],
  },
};

const components: Components = {
  // Template <label>s are guidance for whoever fills in the cover page, not
  // form labels, so render them as hint text.
  label: ({ children }) => <span className={styles.hint}>{children}</span>,
  // Task-list boxes omit `checked` when false; React wouldn't untick a box
  // whose attribute is merely removed, so always pass an explicit value.
  input: ({ type, disabled, checked }) => (
    <input type={type} disabled={disabled} checked={!!checked} readOnly />
  ),
};

/** Renders template markdown safely. */
export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
      components={components}
    >
      {children}
    </ReactMarkdown>
  );
}

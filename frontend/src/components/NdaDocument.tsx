import ReactMarkdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import styles from "./NdaDocument.module.css";

/**
 * The templates contain a little inline HTML: <label> hints on the cover page
 * and <span class="coverpage_link"> references in the standard terms. Allow
 * those (and checked task-list boxes) on top of the default safe schema.
 */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "label"],
  attributes: {
    ...defaultSchema.attributes,
    input: [...(defaultSchema.attributes?.input ?? []), "checked"],
    span: [...(defaultSchema.attributes?.span ?? []), ["className", "coverpage_link"]],
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

function Markdown({ children }: { children: string }) {
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

interface NdaDocumentProps {
  coverPage: string;
  standardTerms: string;
}

export default function NdaDocument({ coverPage, standardTerms }: NdaDocumentProps) {
  return (
    <article className={styles.document}>
      <section>
        <Markdown>{coverPage}</Markdown>
      </section>
      <section className={styles.standardTerms}>
        <Markdown>{standardTerms}</Markdown>
      </section>
    </article>
  );
}

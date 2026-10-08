import { Marked } from "marked";

/** Markdown → HTML za blog (server i pregled u admin editoru). */
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Sirov HTML u markdown-u se prikazuje kao tekst (bez <script> i sl.); linkovi ka drugim sajtovima dobijaju rel.
const marked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }) {
      const safeHref = /^(https?:|mailto:|\/|#)/i.test(href) ? href : "#";
      const external = /^https?:/i.test(safeHref);
      const inner = this.parser.parseInline(tokens);
      return `<a href="${escapeHtml(safeHref)}"${title ? ` title="${escapeHtml(title)}"` : ""}${
        external ? ' rel="noopener noreferrer" target="_blank"' : ""
      }>${inner}</a>`;
    },
  },
});

export function renderMarkdown(md: string) {
  return marked.parse(md, { async: false }) as string;
}

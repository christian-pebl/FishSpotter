import { marked } from "marked";
import { promises as fs } from "node:fs";
import path from "node:path";

interface LegalLayoutProps {
  eyebrow: string;
  file: "privacy-policy.md" | "terms-of-service.md";
}

export async function LegalLayout({ eyebrow, file }: LegalLayoutProps) {
  const filePath = path.join(process.cwd(), "src", "data", "legal", file);
  const md = await fs.readFile(filePath, "utf8");
  const html = await marked.parse(md, { async: true, gfm: true });
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10"
    >
      <div className="pebl-surface rounded-hero p-6 md:p-10">
        <p className="pebl-eyebrow">{eyebrow}</p>
        <article
          className="legal-prose mt-4 text-sm leading-7 text-navy-900"
          // The markdown comes from a trusted in-repo file. We're not
          // rendering user input here, so dangerouslySetInnerHTML is
          // appropriate.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </main>
  );
}

import Link from "next/link";
import { marked } from "marked";
import { promises as fs } from "node:fs";
import path from "node:path";
import { MarineBackdrop } from "@/components/MarineBackdrop";

interface LegalLayoutProps {
  eyebrow: string;
  file: "privacy-policy.md" | "terms-of-service.md" | "accessibility-statement.md";
}

export async function LegalLayout({ eyebrow, file }: LegalLayoutProps) {
  const filePath = path.join(process.cwd(), "src", "data", "legal", file);
  const md = await fs.readFile(filePath, "utf8");
  const html = await marked.parse(md, { async: true, gfm: true });
  return (
    <MarineBackdrop>
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 min-h-0 overflow-y-auto"
    >
      <Link
        href="/"
        className="pebl-button-secondary mb-4 inline-flex w-fit items-center gap-1.5 px-4 text-sm text-navy-900"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 3.5L5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to FishSpotter
      </Link>
      <div className="pebl-surface rounded-card p-6 md:p-10">
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
    </MarineBackdrop>
  );
}

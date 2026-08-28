"use client";

/**
 * The citation control: the small superscript number beside a claim, and the
 * card it opens.
 *
 * The design problem. A citation has to do two jobs that pull against each
 * other: prove the claim, and stay out of the way. The first version made the
 * marker an anchor to `#species-sources`, which on a phone throws the reader to
 * the bottom of a long page with no way back and no indication of which of the
 * six sources was the relevant one. That is a link, not a citation.
 *
 * So the marker opens the source IN PLACE: which source, where in it, and the
 * sentence the claim actually rests on. The full numbered bibliography stays at
 * the foot of the page for anyone who wants it, and the card links down to it.
 *
 * Kept deliberately small: one superscript, teal, no border, no icon. The page
 * carries roughly a dozen of these and they must read as punctuation rather
 * than as a dozen buttons.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ClaimPayload, SourcePayload } from "@/lib/references/payload";

const CARD_W = 300;
const MARGIN = 8;

function CiteCard({
  sources,
  claim,
  anchorRect,
  onClose,
}: {
  sources: SourcePayload[];
  claim: ClaimPayload;
  anchorRect: DOMRect;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [maxH, setMaxH] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => setMounted(true), []);

  /**
   * Position by MEASURING, not by guessing. The first version assumed a 200px
   * card to decide whether to open upwards, and a card with a long quote in it
   * ran off the bottom of the viewport. Once mounted we know the real height,
   * so cap it and let the quote scroll inside the card rather than off-screen.
   */
  useEffect(() => {
    if (!mounted) return;
    const el = cardRef.current;
    if (!el) return;
    const gapBelow = window.innerHeight - anchorRect.bottom - 12;
    const gapAbove = anchorRect.top - 12;
    setMaxH(Math.max(140, Math.min(360, Math.max(gapBelow, gapAbove))));
  }, [mounted, anchorRect]);

  useEffect(() => {
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    // Capture phase: a species guide can sit inside the ID-flow popup, and that
    // dialog also closes on Escape. The citation card must win.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  if (!mounted) return null;

  // Clamp into the viewport: these markers sit mid-sentence, so an unclamped
  // card runs off the right edge on a phone about half the time.
  const left = Math.min(
    Math.max(MARGIN, anchorRect.left + anchorRect.width / 2 - CARD_W / 2),
    window.innerWidth - CARD_W - MARGIN,
  );
  // Open into whichever side has more room, then cap to it.
  const gapBelow = window.innerHeight - anchorRect.bottom - 12;
  const gapAbove = anchorRect.top - 12;
  const openUp = gapAbove > gapBelow;
  const style: React.CSSProperties = {
    left,
    width: CARD_W,
    maxHeight: maxH ?? undefined,
    overflowY: "auto",
    ...(openUp
      ? { bottom: window.innerHeight - anchorRect.top + 6 }
      : { top: anchorRect.bottom + 6 }),
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[95]" onClick={onClose} aria-hidden="true" />
      <div
        ref={cardRef}
        role="dialog"
        aria-label="Source for this statement"
        tabIndex={-1}
        className="pebl-surface fixed z-[96] rounded-modal p-3 shadow-menu outline-none"
        style={style}
      >
        {claim.conflict && (
          <p className="mb-2 rounded-modal bg-surface-muted px-2 py-1.5 text-[11px] leading-relaxed text-incorrect-ink">
            The source below disagrees with this statement. {claim.conflict}
          </p>
        )}

        {sources.map((s) => {
          const passage = claim.support.find((sp) => sp.sourceId === s.id);
          return (
            <div key={s.id} className="border-border [&+&]:mt-2.5 [&+&]:border-t [&+&]:pt-2.5">
              <p className="text-[11px] font-medium leading-snug text-navy-900">{s.title}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-navy-900/55">
                {s.publisher}
                {s.year ? ` (${s.year})` : ""}
              </p>
              {passage?.quote && (
                <blockquote className="mt-1.5 border-l-2 border-teal-500/40 pl-2 text-[11px] italic leading-relaxed text-navy-900/75">
                  {passage.quote}
                </blockquote>
              )}
              {passage?.locator && (
                <p className="mt-1 text-[10px] text-navy-900/50">{passage.locator}</p>
              )}
              {s.url && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex min-h-[32px] items-center text-[11px] font-medium text-teal-600 underline decoration-teal-600/30 underline-offset-2 hover:decoration-teal-600"
                >
                  Read the source
                </a>
              )}
            </div>
          );
        })}

        <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
          <a
            href="#species-sources"
            onClick={onClose}
            className="text-[10px] text-navy-900/55 underline underline-offset-2 hover:text-teal-600"
          >
            All sources for this species
          </a>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[32px] px-1 text-[10px] font-medium text-navy-900/55 hover:text-teal-600"
          >
            Close
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

export function SourceCite({
  claim,
  order,
  allSources,
  tone = "light",
}: {
  claim: ClaimPayload | undefined;
  /** Ordered source ids, so the number matches the bibliography at the foot. */
  order: string[];
  allSources: SourcePayload[];
  /** "dark" for the navy "How to spot it" card, whose text is white. */
  tone?: "light" | "dark";
}) {
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const close = useCallback(() => setAnchorRect(null), []);

  const ids = claim?.sourceIds ?? [];
  const numbers = ids
    .map((id) => order.indexOf(id) + 1)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (numbers.length === 0) return null;

  const sources = ids
    .map((id) => allSources.find((s) => s.id === id))
    .filter((s): s is SourcePayload => Boolean(s));

  const conflicted = Boolean(claim?.conflict);
  const colour = conflicted
    ? tone === "dark"
      ? "text-incorrect"
      : "text-incorrect-ink"
    : tone === "dark"
      ? "text-teal-500"
      : "text-teal-600";

  return (
    <>
      {/* The <sup> is inline-block and the button inline-flex with padding:
          a bare <button> inside a <sup> laid out at ZERO height, so the control
          was unclickable even though it rendered and had a handler. The
          negative margin keeps the padded hit area from pushing the line apart. */}
      <sup
        className={`ml-0.5 inline-block whitespace-nowrap align-super text-[10px] font-semibold leading-none ${colour}`}
      >
        <button
          type="button"
          // Read the rect synchronously into a const BEFORE setState. Reading
          // e.currentTarget inside the updater crashes when React replays it.
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setAnchorRect((open) => (open ? null : rect));
          }}
          aria-expanded={anchorRect !== null}
          aria-label={
            conflicted
              ? `Source ${numbers.join(", ")}, which disagrees with this statement`
              : `Source ${numbers.join(", ")} for this statement`
          }
          className="-my-1 inline-flex min-h-[18px] cursor-pointer items-center px-1 py-1 leading-none underline decoration-dotted underline-offset-2 hover:decoration-solid"
        >
          {numbers.join(",")}
          {conflicted && <span aria-hidden="true"> !</span>}
        </button>
      </sup>
      {anchorRect && claim && (
        <CiteCard sources={sources} claim={claim} anchorRect={anchorRect} onClose={close} />
      )}
    </>
  );
}

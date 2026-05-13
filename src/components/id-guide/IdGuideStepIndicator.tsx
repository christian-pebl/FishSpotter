"use client";

interface Props {
  current: number; // 0-indexed
  total: number;
  label?: string;
}

/** Dotted progress: ● ● ○ ○  with a small "Question 2 of 4" label. */
export function IdGuideStepIndicator({ current, total, label }: Props) {
  if (total <= 0) return null;
  const dots = Array.from({ length: total }, (_, i) => i);
  return (
    <div className="flex items-center gap-3" aria-label={`Question ${current + 1} of ${total}`}>
      <div className="flex items-center gap-1.5" aria-hidden>
        {dots.map((i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              i < current ? "bg-[#3AAFA9]" : i === current ? "bg-[#DEF2F1]" : "bg-white/20"
            }`}
          />
        ))}
      </div>
      {label && <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/55">{label}</span>}
    </div>
  );
}

"use client";

import { motion } from "framer-motion";

interface Props {
  onClick: () => void;
  className?: string;
}

export function IdGuideButton({ onClick, className }: Props) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      data-testid="id-guide-button"
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/85 transition-colors hover:border-[#3AAFA9]/60 hover:bg-[#3AAFA9]/10 hover:text-white ${className ?? ""}`}
    >
      <span aria-hidden>🤔</span>
      <span>Help me figure it out</span>
      <span aria-hidden className="text-[#DEF2F1]">→</span>
    </motion.button>
  );
}

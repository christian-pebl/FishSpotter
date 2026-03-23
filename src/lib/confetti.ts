import confetti from "canvas-confetti";

export function triggerCorrectConfetti(): void {
  if (typeof window === "undefined") return;

  // Ocean-themed colors: teals, blues, corals, sandy gold
  const colors = ["#06b6d4", "#0ea5e9", "#f97316", "#fbbf24", "#34d399", "#a78bfa"];

  const origin = { x: 0.5, y: 0.6 };

  // First burst — big central explosion
  confetti({
    particleCount: 120,
    spread: 90,
    startVelocity: 45,
    origin,
    colors,
    ticks: 200,
    scalar: 1.2,
  });

  // Side bursts for extra flair
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      startVelocity: 50,
      origin: { x: 0, y: 0.65 },
      colors,
      ticks: 180,
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      startVelocity: 50,
      origin: { x: 1, y: 0.65 },
      colors,
      ticks: 180,
    });
  }, 100);
}

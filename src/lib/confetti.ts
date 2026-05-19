import confetti from "canvas-confetti";

export function triggerCorrectConfetti(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  // PEBL brand palette — colorblind-safe (no orange). Teal scale + brand whites.
  const colors = ["#3AAFA9", "#2B7A78", "#DEF2F1", "#FFFFFF", "#1F5F5D"];

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

const STORAGE_KEY = "fishspotter:soundsEnabled";

export function isSoundsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return true;
  return stored === "true";
}

export function setSoundsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent("fishspotter:soundsChanged"));
}

function play(src: string): void {
  if (typeof window === "undefined" || !isSoundsEnabled()) return;
  const audio = new Audio(src);
  audio.volume = 0.5;
  audio.play().catch(() => {});
}

export function playCorrect(): void {
  play("/sounds/correct.mp3");
}

export function playWrong(): void {
  play("/sounds/wrong.mp3");
}

export function playStreak(): void {
  play("/sounds/streak.mp3");
}

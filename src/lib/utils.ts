import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) {
    return "00:00.0"
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  const paddedMinutes = String(minutes).padStart(2, "0")
  const paddedSeconds = String(Math.floor(remainingSeconds)).padStart(2, "0")
  const milliseconds = String(Math.round((remainingSeconds - Math.floor(remainingSeconds)) * 10)).padStart(1,"0")

  return `${paddedMinutes}:${paddedSeconds}.${milliseconds}`
}

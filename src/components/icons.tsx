import type { SVGProps } from "react"

export function AppLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16.5 16.5C19 14.5 21 11.5 21 9c0-3.5-2-7-6-7-2.5 0-4.5 1.5-6 3.5" />
      <path d="M18 10.5c-1.5 0-3-1-4.5-2.5" />
      <path d="M21 9c-1.5 0-3-1-4.5-2.5" />
      <path d="M16.5 16.5C16.5 19 15 21 12 21s-4.5-2-4.5-4.5" />
      <path d="M7.5 16.5C5 14.5 3 11.5 3 9c0-3.5 2-7 6-7 2.5 0 4.5 1.5 6 3.5" />
      <path d="M6 10.5C7.5 10.5 9 9.5 10.5 8" />
      <path d="M3 9c1.5 0 3-1 4.5-2.5" />
      <path d="M7.5 16.5C7.5 19 9 21 12 21s4.5-2 4.5-4.5" />
    </svg>
  )
}

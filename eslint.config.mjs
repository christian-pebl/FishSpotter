// ESLint 9 flat config (Next 16 removed `next lint` and the legacy
// .eslintrc format). Same rule set as before: Next core-web-vitals plus the
// design-token guard that `npm run lint:tokens` enforces.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    // ESLint 9 warns about unused disable comments by default; the old config
    // did not, and `lint:tokens` fails on any warning. Kept off for parity.
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: {
      // eslint-plugin-react-hooks 7 (pulled in by eslint-config-next 16) adds
      // React Compiler advice. These four flag 45 spots in code that works
      // today (mostly "setState inside an effect", e.g. reading localStorage
      // after mount). Off so the upgrade stays a like-for-like change; adopting
      // them is a separate, file-by-file job. The other compiler rules pass and
      // stay on.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "no-restricted-syntax": [
        "error",
        {
          "selector": "JSXAttribute[name.name='className'] Literal[value=/bg-\\[#[0-9a-fA-F]{3,8}\\]|text-\\[#[0-9a-fA-F]{3,8}\\]|border-\\[#[0-9a-fA-F]{3,8}\\]|ring-\\[#[0-9a-fA-F]{3,8}\\]|rounded-\\[\\d+px\\]|tracking-\\[0\\.\\d+em\\]|shadow-\\[/]",
          "message": "Use a design token (Tailwind theme key) instead of an arbitrary-value Tailwind class. See tailwind.config.ts. If you genuinely need a new token, add it there first."
        }
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "storybook-static/**",
  ]),
]);

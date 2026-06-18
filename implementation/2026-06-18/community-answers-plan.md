# Community answers + admin review (2026-06-18)

Goal: regular users see only ANONYMOUS aggregate stats on a clip; PEBL staff
(`@pebl-cic.co.uk`) can see WHO answered WHAT and click through to a spotter's
answers; leaderboard names link to profiles.

(Revised mid-build from an earlier "all users see each other's answers, answer-
first gated" design — see git history of this file.)

## The model

| Surface | Public / regular user | Staff (`@pebl-cic.co.uk`) |
|---|---|---|
| Reveal card (after submit) | Anonymous histogram: count + % per answer, most popular, spotter total | same |
| `/feed/[id]` detail page | Anonymous reveal only | + "How everyone answered" named breakdown (Staff view) |
| `/admin/snippets/[id]` | (admins only anyway) | named breakdown |
| `/u/[id]` profile | Stats + species collection; **individual answers hidden** | full "Recent identifications" list |
| Own `/u/[id]` profile | sees own answers | sees own answers |
| Leaderboard | names link to profiles | same |

Individual answers (which clip a named person guessed what on) are a **staff
review tool**; the public only ever sees anonymous aggregates. A user always
sees their own answers on their own profile.

## Files

- `src/app/api/snippets/[id]/answers/route.ts` (new) — GET, **admin-only** via
  `getAdminSession()`; non-admin -> `{ gated: true }`. Returns each spotter's
  name + pick + verdict, ordered correct/high-points first. No public cache.
- `src/components/SnippetAnswers.tsx` (new) — client panel; renders nothing
  unless the API returns the list (so it's a staff-only overlay). "Staff view"
  chip; names link to `/u/[id]`; verdict chips via `correct`/`incorrect`/
  `pending` tokens; "You" badge.
- `src/app/feed/[id]/page.tsx` — mounts `<SnippetAnswers>` only when
  `getAdminSession()` is non-null.
- `src/app/admin/snippets/[id]/page.tsx` — mounts `<SnippetAnswers>` (the staff
  review home; already admin-gated).
- `src/app/u/[id]/page.tsx` — "Recent identifications" gated to owner-or-admin;
  stats + collection stay public.
- `src/app/leaderboard/page.tsx` — spotter names are links to `/u/[id]`.
- `src/components/idflow/RevealResult.tsx` — community histogram now shows the
  raw count alongside the percent ("3 · 60%"), per "how many people answered
  each answer".

## Verified

8/8 end-to-end checks with minted sessions: guest/regular -> snippet answers
gated; admin -> named list; regular sees own profile answers but not others';
admin sees anyone's; guest sees none; leaderboard renders profile links.
tsc + eslint + lint:tokens clean.

# Admin Tracking Editor — implementation plan

**Date:** 19 Jun 2026
**Owner:** Christian (PEBL CIC)
**Status:** PLAN (not built)

## 1. Goal / user story

The cyan "trace" overlay that follows a creature through a clip (`FeedCard`'s
bbox trail) is derived from the ML export's `bbox_data.json` and is sometimes
**a little off** from where the animal actually is. We want a PEBL-admin-only
way to **re-draw that trace by hand on a phone** and have the corrected trace
become the live one every viewer sees.

> As an admin (`@pebl-cic.co.uk`), I open the **Archive**, tap **Edit tracking**,
> pick a clip, see when its trace was last updated, tap **Edit**, and the clip
> **loops at 0.5× with a 3-second pause before each loop**. While it plays I
> **drag my finger along the fish** to trace its path. It then **plays my trace
> back** so I can confirm it looks right, I tap **Save trace** → **Submit**, and
> that becomes the new trace all viewers see.

## 2. What already exists (reuse, don't rebuild)

| Piece | Where | Notes |
|---|---|---|
| Trace data | `Snippet.bboxJson` (`String?`) | JSON of `BBoxFrame[]`. This is the thing we edit. |
| `BBoxFrame` | `src/components/FeedPlayer.tsx:17` | `{ frame_clip, x_norm, y_norm, w_norm, h_norm }`, all normalised 0..1 except `frame_clip`. |
| Fit + projection math | `fitGeometry()` in `src/components/FeedCard.tsx:69` | Maps the video's intrinsic pixels → on-screen pixels for the current `object-fit` (cover/contain) + `object-position`. **The trace render and the editor MUST share this exact maths**, or the corrected trace will be misaligned again. |
| Trail render loop | `FeedCard.tsx` ~600–740 | Reads normalised center `cx = x_norm + w_norm/2`, EMA-smooths, projects via `offsetX + cx*renderedWidth`, builds a Catmull-Rom smooth path. The editor's preview reuses the same projection. |
| Admin gate | `src/lib/admin.ts` (`requireAdminSession`, `isAdminEmail`) | `@pebl-cic.co.uk` suffix → owner of all `/admin` pages. |
| Admin shell + nav | `src/app/admin/layout.tsx` | Gate + top nav (`Metrics · Species · Snippets`). We add a **Tracking** entry. `robots: noindex`. |
| Admin server-action pattern | `src/app/admin/species/[name]/actions.ts` | `"use server"` + `requireAdminSession()` at the top of every action, coords clamped. Mirror this. |
| Archive page | `src/app/feed/browse/page.tsx` | Where the **Edit tracking** button lives (admin-only). |

### Key insight: coordinate space is the whole ballgame

The current trace lives in **normalised intrinsic-video space** (0..1 of the
source frame). The render projects that into the on-screen, possibly-cropped
(`object-cover`) box. To capture a finger trace correctly we run that projection
**in reverse**:

```
finger (clientX, clientY)
  → subtract video element rect origin           → element-local px
  → subtract fitGeometry.offsetX/offsetY         → rendered-image-local px
  → divide by fitGeometry.renderedWidth/Height   → normalised 0..1  (clamp)
  → store as the box center for the current time
```

Because the live feed currently renders clips with `object-cover` (sides
cropped), a normalised point the admin can't see (cropped off-screen) can't be
traced — which is correct: you only ever correct what's visible. The editor will
render the clip with the **same fit the feed uses** so what you trace is what
ships.

## 3. Data model

Add three columns to `Snippet` (keeps the live read path — `JSON.parse(bboxJson)`
— unchanged):

```prisma
model Snippet {
  // ...existing...
  bboxJson          String?    // live trace (unchanged) — overwritten on submit
  bboxOriginalJson  String?    // one-time backup of the ML trace, set on first edit (revert safety)
  bboxUpdatedAt     DateTime?  // powers "last updated" in the editor list
  bboxUpdatedBy     String?    // admin email, for audit (mirrors DiagnosticMark.createdBy)
}
```

- **Overwrite, not version-history.** The user wants the edited trace to be *the*
  trace viewers see. We keep a single `bboxOriginalJson` backup (written only if
  null, i.e. the first edit) so we can always revert to the ML output. Full
  per-edit history is deferred (a `TraceRevision` table) — not needed for v1.
- Adding columns to an existing table needs `prisma db push` then
  **`npm run db:enable-rls`** is NOT required (no new table; `Snippet` already
  has RLS). Still safe to run.
- `bboxUpdatedAt`/`bboxUpdatedBy` are nullable; `null` ⇒ "ML original, never
  hand-edited" in the UI.

## 4. Frame / timing model (how a finger-over-time becomes `BBoxFrame[]`)

The feed renderer maps **playback progress (0..1)** onto the stored
`frame_clip` range (`getBoxAtProgress`: `targetFrame = first + progress*(last-first)`).
It does **not** depend on the true source fps. So we don't need the real fps:

- While recording, each sample captures `video.currentTime` (seconds).
- On save, convert to `frame_clip = Math.round(currentTime * 1000)` (milliseconds
  as a monotonic synthetic frame index). Sorted ascending, this reproduces
  identical progress→position behaviour in the feed.
- `x_norm = clamp(cx - w/2)`, `y_norm = clamp(cy - h/2)`.
- `w_norm`/`h_norm`: the trail only uses the **center**, so box size barely
  matters for the visible trace. Default to the **median w/h of the existing
  trace** (falls back to `0.08 × 0.08` if there was none). A later enhancement
  can add a pinch-to-size control; not in v1.

Sampling cadence: throttle to one point per `requestAnimationFrame` AND a
minimum movement of ~`TRAIL_MIN_STEP_PX` (reuse the constant) so we don't store
hundreds of redundant points. Cap total points generously (e.g. 600) — the feed
down-samples its own trail to `TRACE_POINT_LIMIT=40` for *rendering*, but we
store the fuller path so future re-renders stay smooth.

## 5. Shared geometry extraction (prerequisite refactor)

`fitGeometry` + the `BBoxFrame`/`Point` types + `buildSmoothPath` are currently
module-private in `FeedCard.tsx`. Extract them so the editor and the feed share
one source of truth:

- New `src/lib/bbox/geometry.ts`:
  - `fitGeometry(cw, ch, vw, vh, center)` (moved verbatim).
  - `projectNormToScreen(p, fit)` and **new** `unprojectScreenToNorm(px, fit)`
    (the inverse used by the editor).
  - `buildSmoothPath(points)` (moved).
  - `traceToBBoxes(samples, sizeDefaults)` + `bboxesToTrace(bboxes)` converters.
- `FeedCard.tsx` imports from there (no behaviour change — pure move).
- Co-located `geometry.test.ts`: round-trip `project → unproject ≈ identity`
  under both cover and contain; `traceToBBoxes` ordering/clamping; size defaults.

This refactor is the thing that **guarantees the corrected trace lines up** with
what the feed draws, and it's independently testable.

## 6. Routes & files

```
src/app/admin/tracking/
  page.tsx                      # list: every clip, thumb, "last updated <date> by <email>" / "ML original"
  [id]/page.tsx                 # server: load snippet (videoUrl, thumb, bboxJson, bboxUpdatedAt/By); guard
  [id]/TrackingEditor.tsx       # client: the record → confirm → submit experience
  actions.ts                    # "use server": saveTrace(snippetId, bboxes), revertTrace(snippetId)

src/lib/bbox/geometry.ts        # shared projection + converters (see §5)
src/lib/bbox/geometry.test.ts

# edits:
src/app/admin/layout.tsx        # add "Tracking" nav link
src/app/feed/browse/page.tsx    # admin-only "Edit tracking" button → /admin/tracking
src/components/FeedCard.tsx     # import geometry from the shared lib
prisma/schema.prisma            # 3 new Snippet columns
```

`/admin/tracking` lives under the existing admin layout, so it inherits the
`requireAdminSession` gate and `noindex` for free. The Archive button is just a
discoverable deep-link (also admin-gated in the page).

## 7. The editor experience (`TrackingEditor.tsx`) — state machine

A small explicit state machine (mirrors the `idflow` reducer style):

`idle → recording → recorded(preview) → saved(confirm) → submitting → done`

1. **idle** — shows the clip's first frame (poster), the current trace drawn as a
   static reference (faint), "Last updated …", and a big **Edit** (record)
   button. Caption: *"Play at half speed and trace the fish with your finger."*

2. **recording** — on tap:
   - `video.playbackRate = 0.5`, `video.currentTime = 0`, play.
   - **No `loop` attribute.** On `ended`: hold the last frame, wait **3000 ms**,
     then `currentTime = 0` and play again (the requested end-of-clip pause).
     A countdown ring shows the 3s pause so it doesn't feel frozen.
   - A full-bleed transparent **pointer-capture** layer over the video collects
     `pointerdown/move/up` (Pointer Events ⇒ touch + mouse). Each accepted sample
     `{ t: video.currentTime, cx, cy }` is unprojected via the shared geometry
     and pushed; a live SVG path draws under the finger so the admin sees the
     trace forming.
   - Sampling only while the finger is down; lifting pauses capture (resuming
     continues the same path — v1 is one continuous trace; multi-segment/gaps
     deferred). A scrub/▮▶ control + "Clear & re-record" are available.
   - **Stop** ends recording → `recorded`.

3. **recorded (preview / "play back the trace")** — the clip loops again at 0.5×
   (same 3s pause) but now **input is disabled** and the **just-recorded trace is
   rendered over it** using the exact feed renderer projection, so the admin
   watches their trace track the fish — the requested confirmation step. Buttons:
   **Re-record** (→ recording, discard) or **Save trace** (→ saved).

4. **saved (final confirm)** — a last "this is what viewers will see" preview +
   summary (N points, duration covered). Buttons: **Back** or **Submit**.

5. **submitting → done** — calls `saveTrace` server action; on success shows
   "Live now ✓", updates "last updated", returns to `idle` with the new trace as
   the reference. A **Revert to original** affordance (calls `revertTrace`) is
   shown whenever `bboxOriginalJson` exists.

Accessibility / mobile: reuse `useModalFocus` patterns where modal; honour
reduced-motion for the countdown; all controls ≥44×44px (UI rule). The capture
layer must not hijack the browser's vertical scroll — set `touch-action: none`
only on the video capture surface.

## 8. Persistence & security (`actions.ts`)

```ts
"use server";
export async function saveTrace(snippetId: string, bboxes: BBoxFrame[]) {
  const { email } = await requireAdminSession();          // gate (redirects non-admins)
  const clean = sanitizeTrace(bboxes);                    // clamp 0..1, finite, sort by frame_clip,
                                                          // cap length, reject empty/garbage
  await prisma.$transaction(async (tx) => {
    const snip = await tx.snippet.findUniqueOrThrow({ where: { id: snippetId },
      select: { bboxJson: true, bboxOriginalJson: true } });
    await tx.snippet.update({
      where: { id: snippetId },
      data: {
        bboxOriginalJson: snip.bboxOriginalJson ?? snip.bboxJson, // backup once
        bboxJson: JSON.stringify(clean),
        bboxUpdatedAt: new Date(),
        bboxUpdatedBy: email,
      },
    });
  });
  revalidatePath("/feed"); revalidatePath("/feed/browse");
}
```

- Every action re-checks `requireAdminSession()` (never trust the client).
- `sanitizeTrace` is a **pure, unit-tested** validator (clamp, finite, sorted,
  length cap, min 2 points) — same spirit as the `DiagnosticMark` coord clamps.
- `revertTrace` restores `bboxJson = bboxOriginalJson` and stamps audit fields.
- `revalidatePath("/feed")` so the corrected trace is live on next view (the feed
  page is `force-dynamic` / SSR, so no long cache to fight).

## 9. Edge cases & decisions

- **No existing trace (`bboxJson === null`).** Allowed — the editor lets an admin
  author a trace from scratch. `bboxOriginalJson` stays null (nothing to back up
  / revert to); show "ML original: none".
- **Clip cropped by `object-cover`.** The editor renders with the same fit as the
  feed, so you can only trace what viewers can see. Acceptable and correct.
- **Finger leaves the frame.** Clamp to 0..1 (the creature is at the edge);
  don't drop the point.
- **Very long clips / many points.** rAF + min-step throttle + a hard cap keeps
  payloads small (≈ a few KB JSON).
- **Two admins editing the same clip.** Last write wins (transactional); v1 has
  no lock. The audit fields make it visible who last touched it.
- **Orientation change mid-record.** `ResizeObserver` re-derives `fitGeometry`;
  stored samples are normalised so they stay valid.

## 10. Testing

- `geometry.test.ts` — project/unproject round-trip (cover + contain),
  `traceToBBoxes` ordering/clamping/size-defaults.
- `trace-sanitize.test.ts` — clamps, drops non-finite, sorts, enforces min/max
  length, rejects empty.
- Component smoke (optional, vitest + RTL): state machine transitions
  idle→recording→recorded→saved→done.
- Manual QA on a real phone at 390px: trace a clip, confirm playback alignment,
  submit, verify the feed shows the corrected trace; revert; verify.
- Pre-push gate (CLAUDE.md): `npx tsc --noEmit && npm test && npm run lint && npm run lint:tokens`.

## 11. Build order (incremental, each shippable)

1. **Geometry extraction + tests** (no UX change; de-risks alignment). Ship.
2. **Schema columns** + `prisma db push` (+ `db:enable-rls` audit run). Ship.
3. **`/admin/tracking` list page** + nav link + admin **Edit tracking** button on
   Archive. (Read-only; lists clips + last-updated.) Ship.
4. **Editor — record + live trace** (no persistence yet; console-dump the trace).
5. **Preview/confirm playback** of the recorded trace.
6. **`saveTrace`/`revertTrace` actions** + wire Submit + revalidate. Ship the
   full loop.
7. Polish: countdown ring, reduced-motion, 44px targets, empty/no-trace states.

## 12. Decisions (locked 19 Jun 2026)

1. **Revert UI**: keep the **ML original only** (single `bboxOriginalJson`
   backup + "Revert to original"). No per-edit history in v1.
2. **Edit scope**: **path only** — redraw the centre line the trace follows; the
   highlight box keeps its existing/default size (median of the prior trace, else
   `0.08×0.08`). No box-resize UI.
3. **Creatures per clip**: **one trace per clip** (matches today's data). Multi-
   trace is a future enhancement, out of scope.
4. **Who can edit**: any `@pebl-cic.co.uk` admin (inherits the standard `/admin`
   gate) — no narrower allow-list. (Assumed; revisit if needed.)

These confirm the plan above as written; build order in §11 stands.
```

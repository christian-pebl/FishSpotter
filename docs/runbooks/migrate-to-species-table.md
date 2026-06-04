# Runbook — Introduce a canonical `Species` table

**Status: planned, not yet executed.** This is a **production database migration**,
so it is intentionally not run autonomously — work through it deliberately, with a
backup, when you're ready and when no other session is mid-change on the schema or
the catalogue.

## Why

Today a species is identified by a free `scientificName` **string** copied across
`SpeciesImage`, `DiagnosticMark`, `SpeciesAlias`, the `SpeciesProbability` blob,
and the in-repo `species-traits.json` — joined *by convention, not by foreign key*
(`schema.prisma:234` literally comments "matches SpeciesImage.scientificName +
species-traits.json keys"). A typo creates a silent orphan; there is no single
"add a species" entry point. A canonical `Species` table fixes this: one row per
species, FK-referenced by the rest, so integrity is enforced by the database.

Do it in **three additive phases** so each step is safe and reversible on its own.
Never combine the FK-enforcement step with the table creation.

---

## Phase 0 — Preconditions (read-only, do first)

1. **No concurrent schema work.** Confirm `git status` is clean on `prisma/schema.prisma`
   and no other session is editing the catalogue. A schema migration mid-churn is how
   the project hit "S3-01 schema drift" before.
2. **Check for existing drift** between `schema.prisma` and prod, so `db push` won't
   apply someone else's un-pushed change:
   ```bash
   npx prisma migrate diff \
     --from-schema-datasource prisma/schema.prisma \
     --to-schema-datamodel prisma/schema.prisma --script
   ```
   It should report **no difference** before you add the model below. If it shows
   unexpected changes, stop and reconcile first.
3. **Find orphan scientificNames** that exist in the data but not the catalogue —
   these would break the FK in Phase 2. Run this read-only check:
   ```ts
   // scripts/_check-species-orphans.ts (temporary)
   import { PrismaClient } from "@prisma/client";
   import { CATALOGUE } from "@/lib/idguide/catalogue";
   const p = new PrismaClient();
   (async () => {
     const known = new Set(Object.keys(CATALOGUE));
     const imgs = await p.speciesImage.findMany({ select: { scientificName: true }, distinct: ["scientificName"] });
     const marks = await p.diagnosticMark.findMany({ select: { scientificName: true }, distinct: ["scientificName"] });
     const aliases = await p.speciesAlias.findMany({ select: { canonical: true } });
     const orphans = new Set<string>();
     for (const r of imgs) if (!known.has(r.scientificName)) orphans.add(r.scientificName);
     for (const r of marks) if (!known.has(r.scientificName)) orphans.add(r.scientificName);
     for (const r of aliases) if (!known.has(r.canonical)) orphans.add(r.canonical);
     console.log(orphans.size ? [...orphans] : "no orphans — safe to FK-enforce");
     await p.$disconnect();
   })();
   ```
   Resolve any orphans (fix the data or add the species to the catalogue) **before
   Phase 2**.

---

## Phase 1 — Create the table + backfill (additive, reversible)

1. **Add the model** to `prisma/schema.prisma`. Keep it standalone first — no
   relations on the existing tables yet:
   ```prisma
   // Canonical registry of catalogued species. The source of truth for "what
   // species exist". Backfilled from species-traits.json; the sibling tables
   // (SpeciesImage, DiagnosticMark, SpeciesAlias) reference it by scientificName
   // (FK added in Phase 2). shapeClass is the top-level "Spot It" gate class.
   model Species {
     scientificName String   @id
     commonName     String
     shapeClass     String
     published      Boolean  @default(false) // true once it has >=1 diagnostic mark
     createdAt      DateTime @default(now())
     updatedAt      DateTime @updatedAt
   }
   ```
2. **Push** (creates the new table only — no data loss; `db push` without
   `--accept-data-loss` refuses any destructive change, so it's safe):
   ```bash
   npx prisma db push
   ```
   Reversible: `DROP TABLE "Species";` if you need to back out.
3. **Backfill** from the validated catalogue. Add this script (it reuses the
   `CATALOGUE` loader, so it can't insert an invalid shapeClass):
   ```ts
   // scripts/seed-species.ts  → wire as "db:seed-species"
   import { PrismaClient } from "@prisma/client";
   import { CATALOGUE } from "@/lib/idguide/catalogue";
   const p = new PrismaClient();
   (async () => {
     let n = 0;
     for (const [scientificName, t] of Object.entries(CATALOGUE)) {
       await p.species.upsert({
         where: { scientificName },
         create: { scientificName, commonName: t.commonName, shapeClass: t.shapeClass },
         update: { commonName: t.commonName, shapeClass: t.shapeClass },
       });
       n++;
     }
     console.log(`Upserted ${n} species.`);
     await p.$disconnect();
   })();
   ```
   ```bash
   npx tsx --env-file=.env.local scripts/seed-species.ts
   ```
4. **Verify** row count == catalogue size (57 today). Add a `species.test.ts` that
   asserts the catalogue and the (mocked) Species rows agree if you want a CI guard.

At this point the table exists and is populated but nothing depends on it — fully
safe to pause here.

---

## Phase 2 — Add the foreign keys (still additive, but has a precondition)

Only after Phase 0 step 3 shows **no orphans**. Add relation fields that reuse the
existing `scientificName` columns as the FK:

```prisma
model SpeciesImage {
  // ...existing fields...
  species Species @relation(fields: [scientificName], references: [scientificName], onDelete: Restrict)
}
model DiagnosticMark {
  // ...existing fields...
  species Species @relation(fields: [scientificName], references: [scientificName], onDelete: Restrict)
}
// On Species, add the back-relations:
model Species {
  // ...existing fields...
  images SpeciesImage[]
  marks  DiagnosticMark[]
}
```

`SpeciesAlias.canonical` can FK too (`references: [scientificName]`) if every
`canonical` is a binomial present in Species — verify in Phase 0.

```bash
npx prisma db push   # adds the FK constraints; fails loudly if any orphan exists
```

If `db push` reports a constraint violation, you have an orphan you missed — go
back to Phase 0 step 3. This is the only step that can fail, and it fails *safely*
(no data changed) rather than corrupting anything.

---

## Phase 3 — Cut over reads (optional, incremental)

Now `Species` is the registry with enforced integrity. Migrate consumers one at a
time, each its own small PR:
- The admin species list (`src/app/admin/species/page.tsx`) reads `Species` instead
  of deriving from the JSON.
- `db:refresh-images` / `seed-*-marks` validate against `Species`.
- Eventually, fold `commonName` + aliases into `Species` and treat
  `species-traits.json` as trait data keyed by the Species id, collapsing the
  "edit 3 files to add a species" ritual (see `add-a-species.md`).

Keep `species-traits.json` + `catalogue.ts` as the **authoring** surface and the CI
gate even after the table exists — the table is the runtime registry, the JSON is
the human-edited source, and `db:seed-species` keeps them in sync.

---

## Rollback

- Phase 2: `db push` after removing the relation fields drops the FK constraints
  (data untouched).
- Phase 1: `DROP TABLE "Species";` (nothing references it if Phase 2 isn't applied).

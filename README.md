# FishSpotter

A responsive game-like web app where users watch short underwater clips, guess the creature, keep streaks alive, and climb the leaderboard on mobile or desktop.

## Recommended free deployment stack

This project is now set up for the free deployment path:

- **App hosting:** Vercel Hobby
- **Database:** Supabase Postgres
- **Media storage:** Supabase Storage
- **Auth:** `next-auth` credentials
- **Installable app:** lightweight PWA support

This keeps the Next.js app and Prisma ORM, but moves the database and media off local disk so the app can be deployed cleanly.

## Local setup

1. Install dependencies

```bash
npm install
```

2. Push the Prisma schema to Supabase Postgres

```bash
npx prisma db push
```

3. Seed snippets

The seed script reads the local **Fish Spotter Snips** folders, uploads media to Supabase Storage when Supabase env vars are set, and inserts snippet rows into the database.

```bash
npm run db:seed
```

Each snippet folder should contain:

- `metadata.json`
- `bbox_data.json`
- `snippet.mp4` or `snippet_h264.mp4`
- `thumbnail.jpg`

4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Create a Supabase project.
2. Create a public storage bucket named `snippets`.
3. Add the environment variables from `.env.example` to Vercel.
4. Deploy the repo to Vercel.
5. Run:

```bash
npx prisma db push
npm run db:seed
```

After that, the deployed app should work on:

- mobile browsers
- desktop browsers
- installable PWA-compatible browsers

## PWA support

The app includes:

- a web app manifest
- service worker registration
- install prompt support when the browser exposes it
- icons for homescreen/app install

Install behavior depends on the browser:

- **Chrome / Edge / Android:** an install prompt can appear automatically or through the `Install app` button
- **iPhone / iPad Safari:** use **Share → Add to Home Screen**

## Scripts

- `npm run dev` – start dev server
- `npm run build` – production build
- `npm run start` – run production server
- `npm run db:push` – push Prisma schema to the database
- `npm run db:seed` – import snippet data and upload media

## Stack

- **Next.js 14** (App Router), **React 18**, **TypeScript**
- **Tailwind CSS**
- **Prisma** + **Supabase Postgres**
- **Supabase Storage**
- **NextAuth.js** credentials auth
- **PWA manifest + service worker**

No admin panel or clip uploader is included yet; snippet content still comes from the seed/import flow.

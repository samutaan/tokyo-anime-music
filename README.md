# Tokyo Anime Music

Official bilingual Astro website: https://tokyo-anime-music.web.app/
Japanese: https://tokyo-anime-music.web.app/ja/

## Development

Node.js 24.19.0 and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test:sync
pnpm build
```

## Catalog

93 registered tracks. `pnpm sync:preview` previews verified Apple Japan catalog changes; `pnpm sync:apply` applies them. Existing entries are never removed by sync. Spotify rankings are dated editorial snapshots. YouTube rankings use daily official API snapshots after credential setup.

## Hosting

Firebase Hosting Spark (free), static `dist` output only. Set `PUBLIC_SITE_URL=https://tokyo-anime-music.web.app` and `PUBLIC_ALLOW_INDEXING=true` for production builds. No paid services or billing upgrades.

GitHub Actions runs daily at approximately 06:17 Japan time and on manual dispatch, synchronizes the verified Apple catalog, tests and builds the site, then deploys to Firebase. Pushes to main run tests, build and deploy without catalog synchronization. Failed steps stop publication. Scheduling can be delayed; GitHub may disable scheduled workflows after prolonged repository inactivity. Secrets belong only in GitHub Actions secrets, never in source files. Local work logs and environment files are excluded.

All character artwork and branding remain the property of their respective rights holders. Public source visibility does not grant a license to reuse these assets.


## YouTube ranking automation

Enable YouTube Data API v3 in the existing Google Cloud project without enabling billing. Create an API key restricted to YouTube Data API v3, then store it only in the GitHub Actions repository secret `YOUTUBE_API_KEY`. Do not use PUBLIC_ variables or commit keys. Run the existing workflow manually to verify the first update.

`pnpm sync:youtube` refreshes lifetime view counts and durations for the reviewed video IDs in `src/data/youtube-videos.json`. The current registry contains videos verified on the official channel Videos tab, excluding Kimi no Shiranai Monogatari. Newly uploaded videos require a channel/content check and adding their ID to this registry; this prevents Shorts or unrelated content from silently entering the ranking. API results must match the official channel. Titles matching the excluded song are also filtered at every sync. Categories are >=600 seconds and <600 seconds, top 10 each, ties resolved by URL/ID. This is not YouTube’s proprietary Popular order.

Daily schedule: approximately 06:17 JST, with manual dispatch also available. One videos.list request per 50 registered videos, capped at 500 IDs (10 calls/run), no retries or paid quota expansion. Missing credentials, quota errors, partial responses or invalid data retain the prior JSON and observation date; the workflow summary reports the failure while the rest of the website can deploy. A missing/private video requires registry review. API keys never enter the browser or built site. Tests: `pnpm test:youtube`.

## Before a new release reaches Apple Music

Add a single reviewed entry to `src/data/releases.json` with a unique stable `id`, exact title, `artist: "Tokyo Anime Music"`, `status: "pending"`, `verified: false`, `preRelease: true`, the verified DistroKid HyperFollow URL, and `registrationCheckedAt` (YYYY-MM-DD). Do not set a release date or streaming links until verified. This is an editorial step, not an automatic DistroKid import, and needs no DistroKid login credentials or paid API. Do not add deleted/unregistered releases.

These entries appear as “Coming soon / 配信準備中” on the home page and in Music. The existing Apple JP sync matches the exact normalized title and updates the same entry when a streamable track appears, preserving the ID and HyperFollow. It then disappears from Coming soon, avoiding a duplicate card. Ambiguous same-title versions are held for review instead of guessed. Test this transition with `pnpm test:sync`; build with `pnpm build` before publishing.

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

93 registered tracks. `pnpm sync:preview` previews verified Apple Japan catalog changes; `pnpm sync:apply` applies them. Existing entries are never removed by sync. Spotify and YouTube rankings are dated editorial snapshots, not live charts.

## Hosting

Firebase Hosting Spark (free), static `dist` output only. Set `PUBLIC_SITE_URL=https://tokyo-anime-music.web.app` and `PUBLIC_ALLOW_INDEXING=true` for production builds. No paid services or billing upgrades.

GitHub automation configuration is being completed. Secrets belong only in GitHub Actions secrets, never in source files. Local work logs and environment files are excluded.

All character artwork and branding remain the property of their respective rights holders. Public source visibility does not grant a license to reuse these assets.

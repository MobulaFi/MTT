## Mobula Trader Terminal (apps/mtt)

Mobula Trader Terminal (`mtt`) is the Next.js 15 App Router frontend that powers the trading dashboards, live pulse feed, and debugging utilities for Mobula. The codebase now follows a feature-first structure with centralized configuration, making it easier to scale individual surfaces (Pulse, TradingView, Wallet analysis, etc.) without tangled imports.

---

### Tooling & Scripts

| Command | Description |
| --- | --- |
| `bun dev` | Run the local Next.js dev server on port 3000 |
| `bun run build` | Create a production build (runs type-check + lint) |
| `bun run lint` | ESLint with the project config |
| `bun run typecheck` | Stand-alone TypeScript check (tsc --noEmit) |

> Tests live under `apps/mtt` and execute via `bun test` from the repo root (preferred runner across Mobula projects).

---

### Configuration

All endpoint-related values are centralized in `src/config/endpoints.ts`:

- `REST_ENDPOINTS`: default REST backends (`premium`, `standard`, etc.)
- `WSS_REGIONS`: curated WebSocket region URLs
- `WSS_TYPES`: whitelist of SDK subscription channels

Client-side code should **never** inline REST/WSS URLs. Import from the config module or consume the Zustand `apiStore`.

Environment variables:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_MOBULA_API_KEY` | Public SDK key for browser traffic |
| `MOBULA_API_URL` | Server-side override for REST calls (e.g., staging) |

The Mobula SDK client (`src/lib/mobulaClient.ts`) automatically respects `apiStore` persistence, cookie overrides, and WSS region preferences.

---

### Project Structure

```
apps/mtt/
├─ public/                  # Static assets + TradingView bundle
├─ src/
│  ├─ app/                  # Next.js App Router entries
│  ├─ config/               # Centralized constants & env helpers
│  ├─ features/
│  │   └─ pulse/            # Pulse-specific components, hooks, stores, utils
│  ├─ components/           # Cross-feature UI (header, footer, shared UI)
│  ├─ hooks/                # Global reusable hooks
│  ├─ lib/                  # SDK wrappers, logging, helpers
│  ├─ store/                # Global Zustand slices (non-feature-specific)
│  ├─ types/                # Shared TypeScript interfaces
│  └─ utils/                # Lightweight helpers & adapters
```

Feature folders (starting with Pulse) co-locate their components, hooks, stores, and utilities to keep imports shallow and make lazy-loading straightforward.

---

### Development Workflow

1. Start the app with `bun dev` and point your browser to `http://localhost:3000`.
2. Pulse-specific work happens under `src/features/pulse`; add new slices/components there instead of the legacy flat folders.
3. When tweaking API behavior, update `src/config/endpoints.ts` (REST or WSS) so the UI, SDK client, and debugging tools stay in sync.
4. Run `bun run lint` + `bun run typecheck` (or `bun test` when specs exist) before opening a PR.

---

### Notes

- The Mobula SDK WebSocket client must **never** be spammed: Pulse filters write to draft state, and `applyFilters()` is the only action that propagates changes to the live subscription.
- Keep UI strings and identifiers in **English** to satisfy the workspace language requirement.
- When introducing new dependencies, add them to `package.json` and run `bun i` (per workspace convention).

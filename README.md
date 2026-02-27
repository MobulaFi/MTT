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
| `MOBULA_SERVER_SIDE_KEY` | **Required** - Server-side API key (never exposed to client) |
| `MOBULA_SERVER_SIDE_API_URL` | Server-side REST URL (default: `https://api.mobula.io`) |
| `NEXT_PUBLIC_MOBULA_API_KEY` | Optional - Public SDK key for client mode |
| `NEXT_PUBLIC_PULSE_DEBUG` | Enable Pulse debug logging |

Example `.env.local`:
```bash
MOBULA_SERVER_SIDE_KEY=your-server-api-key
MOBULA_SERVER_SIDE_API_URL=https://api.mobula.io
NEXT_PUBLIC_PULSE_DEBUG=true
```

---

### Server/Client Mode Architecture

The app supports two API modes, toggled via the **ApiSelectorDropdown** in the header:

| Mode | Description |
| --- | --- |
| **Server** (default) | All API calls proxied through Next.js routes. API key stays on server. |
| **Client** | Direct API calls from browser using user's API key from localStorage. |

#### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                      Server Mode (Default)                       │
├─────────────────────────────────────────────────────────────────┤
│  REST:  sdk.fetchXxx() → /api/sdk → Mobula API                  │
│  WSS:   streams.subscribeXxx() → /api/stream (SSE) → Mobula API │
│  API Key: MOBULA_SERVER_SIDE_KEY (never exposed to browser)     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         Client Mode                              │
├─────────────────────────────────────────────────────────────────┤
│  REST:  sdk.fetchXxx() → Direct to Mobula API                   │
│  WSS:   streams.subscribeXxx() → Direct WebSocket               │
│  API Key: User's key from localStorage                          │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Files

| File | Purpose |
| --- | --- |
| `src/lib/sdkClient.ts` | Unified SDK wrapper with mode-based routing |
| `src/app/api/sdk/route.ts` | REST API proxy for server mode |
| `src/app/api/stream/route.ts` | SSE WebSocket proxy for server mode |

#### Mode Detection

```typescript
// src/lib/sdkClient.ts
export function getCurrentApiMode(): ApiMode {
  if (typeof window === 'undefined') return 'server';  // SSR always server
  const match = document.cookie.match(/apiKeySource=(server|client)/);
  return (match?.[1] as ApiMode) ?? 'server';
}
```

- **SSR pages** always use server mode with `MOBULA_SERVER_SIDE_KEY`
- **Client-side** reads `apiKeySource` cookie (set via UI toggle)
- Toggle triggers page reload to apply new mode

#### Usage

```typescript
import { sdk, streams } from '@/lib/sdkClient';

// REST API calls (auto-routed based on mode)
const data = await sdk.fetchTokenDetails({ address, blockchain });

// WebSocket subscriptions (auto-routed based on mode)
const subscription = streams.subscribeFastTrade(
  { assetMode: false, items: [{ blockchain, address }] },
  (trade) => console.log(trade)
);

// Cleanup
subscription.unsubscribe();
```

---

### Project Structure

```
apps/mtt/
├─ public/                      # Static assets + TradingView bundle
├─ src/
│  ├─ app/
│  │   ├─ api/
│  │   │   ├─ sdk/route.ts      # REST API proxy for server mode
│  │   │   ├─ stream/route.ts   # SSE WebSocket proxy for server mode
│  │   │   └─ mobula-server-config/route.ts
│  │   ├─ token/[blockchain]/[address]/page.tsx   # Token page (SSR)
│  │   ├─ pair/[blockchain]/[address]/page.tsx    # Pair page (SSR)
│  │   └─ layout.tsx
│  ├─ config/                   # Centralized constants & env helpers
│  ├─ features/
│  │   ├─ pulse/                # Pulse-specific components, hooks, stores
│  │   ├─ token/                # Token page components, hooks, stores
│  │   └─ pair/                 # Pair page components, hooks, stores
│  ├─ components/
│  │   ├─ header/
│  │   │   └─ ApiSelectorDropdown.tsx  # Server/Client mode toggle
│  │   ├─ charts/               # TradingView chart components
│  │   └─ ...                   # Cross-feature UI
│  ├─ hooks/                    # Global reusable hooks
│  ├─ lib/
│  │   ├─ sdkClient.ts          # Unified SDK wrapper (mode-based routing)
│  │   ├─ mobulaClient.ts       # Raw Mobula SDK client (for SSR)
│  │   └─ networkLogger.ts      # Request logging
│  ├─ store/
│  │   ├─ apiStore.ts           # API settings & mode persistence
│  │   └─ ...                   # Global Zustand slices
│  ├─ types/                    # Shared TypeScript interfaces
│  └─ utils/                    # Lightweight helpers & adapters
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

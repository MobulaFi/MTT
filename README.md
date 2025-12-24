# Mobula Trader Terminal (MTT)

Mobula Trader Terminal (`mtt`) is a Next.js 16 application built with the App Router that provides a comprehensive trading dashboard, live pulse feed, and debugging utilities for the Mobula ecosystem. The application follows a feature-first architecture with centralized configuration, enabling scalable development of individual surfaces (Pulse, TradingView, Wallet analysis, etc.) without tangled imports. It utilizes `@mobula_labs/sdk` and `@mobula_labs/types`, and serves as a working example of Mobula integration.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Key Features](#key-features)
- [Configuration](#configuration)
- [Development Workflow](#development-workflow)
- [Building & Deployment](#building--deployment)
- [Best Practices](#best-practices)

## Tech Stack

### Core Framework
- **Next.js 16** - React framework with App Router
- **React 19** - UI library (RC version)
- **TypeScript 5.6** - Type safety

### State Management
- **Zustand 5.0.3** - Lightweight state management
- **Immer** - Immutable state updates

### UI & Styling
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
  - Dialog, Tooltip, Popover, Checkbox, Hover Card, Separator
- **Lucide React** - Icon library
- **Sonner** - Toast notifications
- **next-themes** - Theme management

### Data & Networking
- **@mobula_labs/sdk** - Mobula SDK for API interactions
- **@mobula_labs/types** - Shared TypeScript types
- **viem** - Ethereum library for wallet interactions

### Utilities
- **date-fns** - Date manipulation
- **react-window** - Virtualized lists
- **react-resizable-panels** - Resizable panel layouts

### Development Tools
- **Vitest** - Testing framework
- **ESLint** - Code linting
- **TypeScript** - Type checking

## Getting Started

### Prerequisites

- **Bun** (recommended package manager)
- Node.js 20+ (if not using Bun)

### Installation

1. Install dependencies from the workspace root:
```bash
bun install
```

2. Set up environment variables (if needed):
```bash
# Create .env.local in apps/mtt/ if required
NEXT_PUBLIC_MOBULA_API_KEY=your_api_key_here
MOBULA_API_URL=https://api.mobula.io  # Optional: server-side override
```

3. Start the development server:
```bash
cd apps/mtt
bun dev
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
apps/mtt/
├── public/                    # Static assets + TradingView bundle
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── api/               # API routes
│   │   ├── embed/             # Embeddable views
│   │   ├── pair/              # Trading pair pages
│   │   ├── token/             # Token detail pages
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Home page (Pulse feed)
│   │
│   ├── features/              # Feature-based modules
│   │   ├── pulse/             # Pulse feed feature
│   │   │   ├── components/   # Pulse-specific components
│   │   │   ├── context/       # React context providers
│   │   │   ├── hooks/         # Feature hooks
│   │   │   └── store/         # Zustand stores
│   │   ├── pair/              # Trading pair feature
│   │   └── token/             # Token feature
│   │
│   ├── components/            # Shared UI components
│   │   ├── charts/            # TradingView chart integration
│   │   ├── embed/             # Embed components
│   │   ├── header/            # Header sub-components
│   │   ├── shared/            # Shared components (StatsCard, etc.)
│   │   ├── tables/            # Data tables
│   │   ├── trades/            # Trading components
│   │   ├── ui/                # Base UI components (Radix wrappers)
│   │   └── wallet/            # Wallet connection components
│   │
│   ├── config/                # Centralized configuration
│   │   └── endpoints.ts       # REST & WebSocket endpoints
│   │
│   ├── hooks/                 # Global reusable hooks
│   │   ├── trading/           # Trading-specific hooks
│   │   └── wallet/           # Wallet-specific hooks
│   │
│   ├── lib/                   # Core libraries & utilities
│   │   ├── embed/             # Embed validation
│   │   ├── wallet/            # Wallet connectors & providers
│   │   ├── mobulaClient.ts    # Mobula SDK wrapper
│   │   └── networkLogger.ts  # Network debugging
│   │
│   ├── store/                 # Global Zustand stores
│   │   ├── apiStore.ts        # API configuration store
│   │   ├── tradingStore.ts    # Trading state
│   │   ├── useThemeStore.ts   # Theme management
│   │   └── ...                # Other global stores
│   │
│   ├── types/                 # Shared TypeScript types
│   │   ├── swap.ts            # Swap-related types
│   │   ├── trading.ts         # Trading types
│   │   └── wallet.ts          # Wallet types
│   │
│   └── utils/                 # Utility functions
│       ├── chainMapping.ts    # Blockchain mappings
│       ├── Formatter.tsx      # Data formatting
│       ├── StatsCardAdapter.tsx
│       └── tradingview/       # TradingView helpers
│
├── scripts/                   # Build & utility scripts
├── next.config.js             # Next.js configuration
├── tailwind.config.js         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
└── vitest.config.ts           # Vitest configuration
```

### Architecture Principles

- **Feature-First Structure**: Features co-locate their components, hooks, stores, and utilities
- **Centralized Configuration**: All API endpoints and WebSocket regions are defined in `src/config/endpoints.ts`
- **Shared Components**: Cross-feature UI lives in `src/components/`
- **Global Stores**: Non-feature-specific Zustand slices in `src/store/`

## Key Features

### 1. Pulse Feed
Real-time token trading feed with live updates via WebSocket. Located in `src/features/pulse/`.

**Key Components:**
- `PulseHeader` - Feed controls and filters
- `TokenSection` - Token list with live updates
- `PulseStreamProvider` - WebSocket context provider

**Important**: Pulse filters write to draft state; only `applyFilters()` propagates changes to the live subscription. Never spam the WebSocket client.

### 2. Token Pages
Comprehensive token detail pages with charts, trades, holders, and statistics.

**Route**: `/token/[blockchain]/[address]`

**Features:**
- TradingView charts
- Live trades table
- Top traders
- Holders analysis
- Token statistics

### 3. Trading Pair Pages
Trading pair analysis with combined trade data and market statistics.

**Route**: `/pair/[blockchain]/[address]`

**Features:**
- Combined trades from both tokens
- Market depth visualization
- Pair statistics
- Historical data

### 4. Trading Interface
Integrated swap interface with quote generation and transaction execution.

**Components:**
- `SwapQuoteModal` - Quote display and execution
- `TradingWindow` - Main trading interface
- `SettingsModal` - Trading preferences

### 5. Wallet Analysis
Wallet portfolio analysis, position tracking, and activity monitoring.

**Features:**
- Portfolio overview
- Active positions
- Transaction history
- Wallet connection (EIP-6963 support)

### 6. Embeddable Views
Lightweight embeddable components for token and pool data.

**Route**: `/embed/token/[blockchain]/[address]` or `/embed/pool/[blockchain]/[address]`

## Configuration

### API Endpoints

All endpoint configuration is centralized in `src/config/endpoints.ts`:

```typescript
// REST Endpoints
REST_ENDPOINTS = {
  PREMIUM: 'https://pulse-v2-api.mobula.io',
  STANDARD: 'https://api.mobula.io',
  EXPLORER: 'https://explorer-api.mobula.io',
}

// WebSocket Regions
WSS_REGIONS = {
  default: 'wss://default.mobula.io',
  ovh: 'wss://api.zobula.xyz',
  mobula: 'wss://api.mobula.io',
  'pulse-v2': 'wss://pulse-v2-api.mobula.io',
}
```

**Important**: Client-side code should **never** inline REST/WSS URLs. Always import from the config module or consume the Zustand `apiStore`.

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_MOBULA_API_KEY` | Public SDK key for browser traffic | Yes |
| `MOBULA_API_URL` | Server-side override for REST calls (e.g., staging) | No |

### Mobula SDK Client

The Mobula SDK client (`src/lib/mobulaClient.ts`) automatically:
- Respects `apiStore` persistence
- Handles cookie overrides
- Manages WSS region preferences

## Development Workflow

### Available Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start Next.js dev server on port 3000 |
| `bun run build` | Create production build (runs type-check + lint) |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint with project config |
| `bun run typecheck` | Stand-alone TypeScript check (`tsc --noEmit`) |

### Development Guidelines

1. **Start Development**
   ```bash
   cd apps/mtt
   bun dev
   ```
   Navigate to `http://localhost:3000`

2. **Feature Development**
   - Pulse-specific work: `src/features/pulse/`
   - Add new features following the feature-first structure
   - Co-locate components, hooks, stores, and utilities

3. **API Configuration**
   - Update `src/config/endpoints.ts` for REST or WSS changes
   - Ensures UI, SDK client, and debugging tools stay in sync

4. **Pre-commit Checklist**
   - Run `bun run lint`
   - Run `bun run typecheck`

## Building & Deployment

### Production Build

```bash
bun run build
```

This command:
1. Runs TypeScript type checking
2. Runs ESLint
3. Builds the Next.js application
4. Optimizes assets and code splitting

### Build Configuration

Key Next.js optimizations:
- **Package Imports**: Optimized imports for large libraries (lucide-react, Radix UI, date-fns, viem)
- **Console Removal**: Production builds remove console logs (except error/warn)
- **Image Optimization**: Remote images with AVIF/WebP support
- **Compression**: Enabled for production

### TypeScript Configuration

- **Strict Mode**: Enabled
- **Path Aliases**: `@/*` maps to `./src/*`
- **Build Errors**: Ignored in `next.config.js` (use `bun run typecheck` for validation)

## Best Practices

### WebSocket Usage

⚠️ **Critical**: The Mobula SDK WebSocket client must **never** be spammed.

- Pulse filters write to draft state
- `applyFilters()` is the only action that propagates changes to the live subscription
- Avoid creating multiple subscriptions for the same data

### State Management

- Use **Zustand** for global and feature-specific state
- Keep stores focused and co-located with features when possible
- Use **Immer** for complex state updates

### Component Organization

- **Feature components**: `src/features/[feature]/components/`
- **Shared components**: `src/components/`
- **UI primitives**: `src/components/ui/` (Radix wrappers)

### API Integration

- Always use the Mobula SDK client from `src/lib/mobulaClient.ts`
- Never hardcode API endpoints; use `src/config/endpoints.ts`
- Respect `apiStore` for endpoint selection

### Performance

- Use `react-window` for large lists
- Leverage Next.js App Router for automatic code splitting
- Optimize package imports (configured in `next.config.js`)
- Use `React.memo` for expensive components

### Accessibility

- Use Radix UI primitives for accessible components
- Ensure proper ARIA labels and keyboard navigation
- Test with screen readers


## Troubleshooting

### Common Issues

1. **TypeScript Errors**
   - Run `bun run typecheck` to see all errors
   - Check `tsconfig.json` path aliases

2. **WebSocket Connection Issues**
   - Verify `WSS_REGIONS` in `src/config/endpoints.ts`
   - Check `apiStore` for selected region
   - Review network logs in browser DevTools


3. **Theme Issues**
   - Verify `useThemeStore` is properly initialized
   - Check `tailwind.config.js` for custom colors
   - Ensure theme persistence in localStorage

## Additional Resources

- **Mobula SDK**: [@mobula_labs/sdk](https://www.npmjs.com/package/@mobula_labs/sdk)
- **Mobula Types**: [@mobula_labs/types](https://www.npmjs.com/package/@mobula_labs/types)
- **Next.js Documentation**: [nextjs.org/docs](https://nextjs.org/docs)
- **Zustand Documentation**: [github.com/pmndrs/zustand](https://github.com/pmndrs/zustand)
- **Radix UI**: [radix-ui.com](https://www.radix-ui.com)



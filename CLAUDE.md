# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

アイドルマスター公式 IDOL LISTからアイドルの共起関係データをスクレイピングし、可視化するプロジェクト。

## Commands

```bash
# Development
pnpm dev              # Start Vite dev server
pnpm build            # TypeScript check + Vite build
pnpm preview          # Preview built app
pnpm typecheck        # Type check only

# Scraping (requires Playwright)
pnpm scrape:list      # Fetch idol list from website
pnpm scrape:details   # Fetch idol details (run after list)
pnpm transform:normalize  # Normalize scraped data

# Testing & Quality
pnpm test             # Run Vitest in watch mode
pnpm test:run         # Run tests once
pnpm test:coverage    # Run tests with coverage
pnpm lint             # Run oxlint
pnpm lint:fix         # Run oxlint with auto-fix
pnpm format           # Format with Prettier
pnpm format:check     # Check formatting
pnpm clean            # Run knip (unused code detection)
```

## Architecture

### Three-Layer Pipeline

1. **Scraper** (`src/scraper/`)
   - `fetchIdolList.ts`: Uses Playwright to scrape idol list from https://idollist.idolmaster-official.jp/
   - `fetchIdolDetails.ts`: Uses JSDOM to fetch each idol's co-appearing characters with rate limiting
   - Output: JSON files in `data/` (e.g., `idols-YYYY-MM-DD.json`, `details-YYYY-MM-DD.json`)

2. **Transformer** (`src/transformer/`)
   - `normalizeDetails.ts`: Converts scraped data into normalized format
   - Output: `normalized-YYYY-MM-DD.json` with `idols` map and `cooccurrences` adjacency list

3. **Visualizer** (`src/visualizer/`)
   - React app with Vite, renders from `src/visualizer/` (custom root)
   - `App.tsx`: Main component with brand filters and tab navigation
   - `components/CooccurrenceRanking.tsx`: Ranking list with recharts bar chart
   - `components/NetworkGraph.tsx`: SVG-based network visualization
   - `hooks/useCooccurrenceData.ts`: Data fetching and statistics computation

### Data Flow

```
Website → Playwright → idols.json → JSDOM → details.json → normalize → normalized.json → React
```

### Types (`src/types/index.ts`)

- `Brand`: Union type for franchise brands (imas, deremas, milimas, sidem, shiny, gakuen)
- `Idol`: Basic idol info (link, brand[], name)
- `IdolDetail`: Idol + cooccurring idols
- `ScrapeResult<T>`: Wrapper with metadata

## Path Aliases

- `@/*` → `./src/*`
- `@/types` → `./src/types`

## Data Location

Scraped/transformed data stored in `data/` directory. The visualizer serves this as public directory.

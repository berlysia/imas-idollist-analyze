# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

アイドルマスター公式 IDOL LISTからアイドルの随伴データをスクレイピングし、可視化するプロジェクト。

### 用語定義

- **随伴（A→B）**: アイドルAのページにアイドルBが掲載されている関係
- **相互随伴（A↔B）**: AとBが互いのページに掲載されている関係
- **共起（B‖C｜A）**: アイドルAのページにBとCが同時に掲載されている関係
- **共起元（cooccurrenceSource）**: 共起関係の文脈となるアイドル（上記のA）
- **共起随伴ペア（CooccurrenceCompanionPair）**: 異なるブランドのアイドル2人が複数の共起元のページで同時に随伴として掲載されているペア

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
pnpm preprocess       # Normalize and precompute all data

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

### Directory Structure

```
├── app/                    # HonoX application (SSG)
│   ├── components/         # Shared React components
│   ├── hooks/              # Custom React hooks
│   ├── islands/            # Interactive island components
│   ├── lib/                # Utility functions and computations
│   ├── routes/             # Page routes
│   └── types/              # TypeScript type definitions
├── scripts/                # Build and scraping scripts
│   ├── scraper/            # Web scraping modules
│   └── transformer/        # Data transformation modules
├── data/                   # Scraped and processed data
└── tests/                  # Test files
```

### Three-Layer Pipeline

1. **Scraper** (`scripts/scraper/`)
   - `fetchIdolList.ts`: Uses Playwright to scrape idol list from https://idollist.idolmaster-official.jp/
   - `fetchIdolDetails.ts`: Uses JSDOM to fetch each idol's accompanying idols with rate limiting
   - Output: JSON files in `data/raw/`

2. **Transformer** (`scripts/transformer/`)
   - `normalizeDetails.ts`: Converts scraped data into normalized format
   - `index.ts`: Precomputes rankings, clusters, and per-idol data
   - Output: `data/normalized.json` and `data/precomputed/`

3. **Visualizer** (`app/`)
   - HonoX SSG application with React islands
   - `routes/`: Page components for each view
   - `islands/`: Interactive components (charts, graphs, filters)
   - `lib/compute.ts`: Data computation utilities

### Data Flow

```
Website → Playwright → idols.json → JSDOM → details.json → normalize → normalized.json → HonoX SSG
```

### Types (`app/types/index.ts`)

- `Brand`: Union type for franchise brands (imas, deremas, milimas, sidem, shiny, gakuen)
- `Idol`: Basic idol info (link, brand[], name)
- `IdolDetail`: Idol + accompanying idols
- `ScrapeResult<T>`: Wrapper with metadata

## Path Aliases

- `@/types` → `./app/types`

## Data Location

Scraped/transformed data stored in `data/` directory. The visualizer serves this as public directory.

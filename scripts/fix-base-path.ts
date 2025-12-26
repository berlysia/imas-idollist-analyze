import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";

const BASE_PATH = process.env.BASE_PATH || "/";
const DIST_DIR = join(import.meta.dirname, "..", "dist");
const MANIFEST_PATH = join(DIST_DIR, ".vite", "manifest.json");

interface ManifestEntry {
  file: string;
  src?: string;
  isEntry?: boolean;
}

type Manifest = Record<string, ManifestEntry>;

async function* walkDir(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

async function loadManifest(): Promise<Manifest | null> {
  try {
    const content = await readFile(MANIFEST_PATH, "utf-8");
    return JSON.parse(content) as Manifest;
  } catch {
    console.warn("Manifest file not found, skipping script path resolution.");
    return null;
  }
}

async function fixBasePath() {
  // normalizedBase is empty string for "/" or the path without trailing slash
  const normalizedBase = BASE_PATH === "/" ? "" : BASE_PATH.endsWith("/") ? BASE_PATH.slice(0, -1) : BASE_PATH;
  const manifest = await loadManifest();

  // Build script path replacements from manifest
  const scriptReplacements: Array<{ from: RegExp; to: string }> = [];
  if (manifest) {
    for (const [key, entry] of Object.entries(manifest)) {
      if (entry.isEntry && entry.file) {
        // Match src="/app/client.ts" or src="/key"
        const srcPath = entry.src || key;
        scriptReplacements.push({
          from: new RegExp(`src="/${srcPath.replace(/^\//, "")}"`, "g"),
          to: `src="${normalizedBase}/${entry.file}"`,
        });
      }
    }
  }

  console.log(`Fixing base path to: ${BASE_PATH}`);
  if (scriptReplacements.length > 0) {
    console.log(`Script replacements from manifest: ${scriptReplacements.length}`);
  }

  let fileCount = 0;

  for await (const filePath of walkDir(DIST_DIR)) {
    if (extname(filePath) !== ".html") continue;

    const originalContent = await readFile(filePath, "utf-8");
    let content = originalContent;

    // Replace script sources using manifest (always needed)
    for (const { from, to } of scriptReplacements) {
      content = content.replace(from, to);
    }

    // Fix absolute paths in href and src attributes (only if BASE_PATH is not "/")
    // Use negative lookahead to avoid double-replacing paths that already have the base path
    if (BASE_PATH !== "/") {
      const escapedBase = normalizedBase.slice(1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      content = content
        .replace(new RegExp(`href="\\/(?!\\/)(?!${escapedBase}\\/)`, "g"), `href="${normalizedBase}/`)
        .replace(new RegExp(`src="\\/(?!\\/)(?!${escapedBase}\\/)`, "g"), `src="${normalizedBase}/`)
        .replace(new RegExp(`data-fetch-url="\\/(?!\\/)(?!${escapedBase}\\/)`, "g"), `data-fetch-url="${normalizedBase}/`);
    }

    if (content !== originalContent) {
      await writeFile(filePath, content, "utf-8");
      fileCount++;
    }
  }

  console.log(`Updated ${fileCount} HTML files.`);
}

fixBasePath();

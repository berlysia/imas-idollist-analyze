import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";

const BASE_PATH = process.env.BASE_PATH || "/";
const DIST_DIR = join(import.meta.dirname, "..", "dist");

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

async function fixBasePath() {
  if (BASE_PATH === "/") {
    console.log("BASE_PATH is '/', no changes needed.");
    return;
  }

  console.log(`Fixing base path to: ${BASE_PATH}`);

  const normalizedBase = BASE_PATH.endsWith("/") ? BASE_PATH.slice(0, -1) : BASE_PATH;

  let fileCount = 0;

  for await (const filePath of walkDir(DIST_DIR)) {
    if (extname(filePath) !== ".html") continue;

    const content = await readFile(filePath, "utf-8");

    const updated = content
      // Fix absolute paths in href and src attributes
      .replace(/href="\/(?!\/)/g, `href="${normalizedBase}/`)
      .replace(/src="\/(?!\/)/g, `src="${normalizedBase}/`)
      // Fix data-fetch-url attributes for precomputed data
      .replace(/data-fetch-url="\/(?!\/)/g, `data-fetch-url="${normalizedBase}/`);

    if (content !== updated) {
      await writeFile(filePath, updated, "utf-8");
      fileCount++;
    }
  }

  console.log(`Updated ${fileCount} HTML files.`);
}

fixBasePath();

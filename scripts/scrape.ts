import { fetchIdolList } from "./scraper/fetchIdolList.ts";
import { fetchAllIdolDetails, extractIdolId } from "./scraper/fetchIdolDetails.ts";
import type { IdolDetail } from "../app/types/index.ts";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const DATA_DIR = path.resolve(import.meta.dirname, "../data/raw");

async function saveJson(filepath: string, data: unknown): Promise<void> {
  await fs.writeFile(filepath, JSON.stringify(data, null, 2), "utf-8");
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * 取得済みのアイドルIDセットを取得
 */
async function getExistingIdolIds(detailsDir: string): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const files = await fs.readdir(detailsDir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const id = file.replace(".json", "");
        ids.add(id);
      }
    }
  } catch {
    // ディレクトリが存在しない場合は空セット
  }
  return ids;
}

/**
 * 詳細ファイルを統合（ID順にソート）
 */
async function mergeDetailFiles(detailsDir: string): Promise<IdolDetail[]> {
  const files = await fs.readdir(detailsDir);
  const jsonFiles = files
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => {
      const idA = parseInt(a.replace(".json", ""), 10);
      const idB = parseInt(b.replace(".json", ""), 10);
      return idA - idB;
    });

  const details: IdolDetail[] = [];
  for (const file of jsonFiles) {
    const filepath = path.join(detailsDir, file);
    const content = await fs.readFile(filepath, "utf-8");
    details.push(JSON.parse(content) as IdolDetail);
  }

  return details;
}

async function main(): Promise<void> {
  const detailsDir = path.join(DATA_DIR, "details");
  await ensureDir(detailsDir);

  // Step 1: Fetch idol list
  console.log("[scrape] Step 1: アイドル一覧を取得中...");
  const listResult = await fetchIdolList();
  console.log(`[scrape] アイドル一覧取得完了: ${listResult.data.length}件`);

  const listFilename = path.join(DATA_DIR, `idols.json`);
  await saveJson(listFilename, listResult);
  console.log(`[scrape] 一覧を保存: ${listFilename}`);

  // Step 2: Fetch details for all idols (with resume support)
  console.log("[scrape] Step 2: 詳細情報を取得中...");
  await ensureDir(detailsDir);

  const existingIds = await getExistingIdolIds(detailsDir);
  console.log(`[scrape] 取得済み: ${existingIds.size}件`);

  const startTime = Date.now();
  await fetchAllIdolDetails(listResult.data, {
    skipIds: existingIds,
    onIdolFetched: async (detail) => {
      const idolId = extractIdolId(detail.link);
      const filepath = path.join(detailsDir, `${idolId}.json`);
      await saveJson(filepath, detail);
      console.log(`[scrape] 保存: ${filepath}`);
    },
  });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[scrape] 詳細取得完了 (${elapsed}秒)`);

  // Step 3: Merge all detail files
  console.log("[scrape] Step 3: 詳細ファイルを統合中...");
  const allDetails = await mergeDetailFiles(detailsDir);
  const mergedFilename = path.join(DATA_DIR, `details.json`);
  await saveJson(mergedFilename, {
    scrapedAt: new Date().toISOString(),
    count: allDetails.length,
    data: allDetails,
  });
  console.log(`[scrape] 統合ファイルを保存: ${mergedFilename} (${allDetails.length}件)`);
  console.log("[scrape] 完了!");
}

main();

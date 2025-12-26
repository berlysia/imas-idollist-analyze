import { fetchIdolList } from "./fetchIdolList.ts";
import { fetchAllIdolDetails } from "./fetchIdolDetails.ts";
import type { IdolDetail } from "../../app/types/index.ts";
import * as fsp from "node:fs/promises";
import * as fs from "node:fs";
import * as path from "node:path";

const DATA_DIR = path.resolve(import.meta.dirname, "../../data/raw");

const IDOLS_FILE = "idols.json";
const DETAILS_DIR = "details";
const DETAILS_FILE = "details.json";

async function saveJson(filename: string, data: unknown): Promise<void> {
  const filepath = path.join(DATA_DIR, filename);
  await fsp.writeFile(filepath, JSON.stringify(data, null, 2), "utf-8");
}

function fileExists(filepath: string): boolean {
  return fs.existsSync(filepath);
}

async function runListScrape(): Promise<void> {
  const result = await fetchIdolList();
  await saveJson(IDOLS_FILE, result);
  console.log(`Saved ${result.data.length} idols to ${IDOLS_FILE}`);
}

async function runDetailsScrape(): Promise<void> {
  const idolsPath = path.join(DATA_DIR, IDOLS_FILE);
  if (!fileExists(idolsPath)) {
    throw new Error("No idols file found. Run list scrape first.");
  }

  const idolsData = JSON.parse(await fsp.readFile(idolsPath, "utf-8"));

  // レジューム: 既存のdetailsディレクトリから [id].json 形式のファイル名を探して取得済みIDを特定する
  const detailsPath = path.join(DATA_DIR, DETAILS_DIR);
  const existingDetails: IdolDetail[] = [];
  const skipIds: Set<string> = new Set();

  if (fileExists(detailsPath)) {
    try {
      const files = await fsp.readdir(detailsPath);
      const jsonFiles = files.filter((file) => file.endsWith(".json"));
      for (const file of jsonFiles) {
        const filepath = path.join(detailsPath, file);
        const content = await fsp.readFile(filepath, "utf-8");
        existingDetails.push(JSON.parse(content) as IdolDetail);
        skipIds.add(path.basename(file, ".json"));
      }

      console.log(`[resume] Found ${existingDetails.length} already fetched idols`);
    } catch {
      console.log("[resume] Could not parse existing details file, starting fresh");
    }
  }

  // インクリメンタル保存用コールバック
  const allDetails = [...existingDetails];

  const onIdolFetched = async (detail: IdolDetail): Promise<void> => {
    allDetails.push(detail);
    // 10件ごとに中間保存
    if (allDetails.length % 10 === 0) {
      await saveJson(DETAILS_FILE, {
        scrapedAt: new Date().toISOString(),
        count: allDetails.length,
        data: allDetails,
      });
      console.log(`[checkpoint] Saved ${allDetails.length} details`);
    }
  };

  const newDetails = await fetchAllIdolDetails(idolsData.data, {
    ...(skipIds && { skipIds }),
    onIdolFetched,
  });

  // 最終保存
  const finalDetails = [...existingDetails, ...newDetails];
  await saveJson(DETAILS_FILE, {
    scrapedAt: new Date().toISOString(),
    count: finalDetails.length,
    data: finalDetails,
  });
  console.log(`Saved ${finalDetails.length} details to ${DETAILS_FILE}`);
}

const command = process.argv[2];

if (command === "list") {
  runListScrape();
} else if (command === "details") {
  runDetailsScrape();
} else {
  process.stderr.write("Usage: node scripts/scraper/index.ts <list|details>\n");
  process.exit(1);
}

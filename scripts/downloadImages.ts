import * as fs from "node:fs/promises";
import * as path from "node:path";
import { extractIdolId } from "../src/scraper/fetchIdolDetails.ts";
import type { Idol, ScrapeResult } from "../src/types/index.ts";

/*

アイコン画像の取得

https://idolmaster-official.jp/mydesk/setting/idol でログイン済みにする

```js
const data = document.querySelector(".style_idolSelector__4gF0L").querySelectorAll("button").values().map(x => {
  const img = x.querySelector("img");
  const name = x.querySelector(".style_idolSelector_button_txt__m__Qd").textContent;
  return {
    img: img.src,
    name,
  };
}).toArray();

copy(data);
```

結果を data/raw/image.json に保存しておく

*/

const DATA_DIR = path.resolve(import.meta.dirname, "../data/raw");
const OUTPUT_DIR = path.resolve(import.meta.dirname, "../public/static/icons");

const MAX_RETRIES = 3;
const FETCH_TIMEOUT = 30000;
const CONCURRENCY = 5;
const DELAY_MS = 300;

interface ImageEntry {
  img: string;
  name: string;
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// image.jsonとidols.jsonで名前表記が異なるケースの対応表
const NAME_ALIASES: Record<string, string> = {
  エミリー: "エミリー スチュアート",
};

/**
 * 名前からIDへのマッピングを作成
 */
function buildNameToIdMap(idols: Idol[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const idol of idols) {
    const id = extractIdolId(idol.link);
    if (id) {
      map.set(idol.name, id);
    }
  }
  return map;
}

/**
 * 名前からIDを解決（エイリアス対応）
 */
function resolveIdolId(name: string, nameToIdMap: Map<string, string>): string | undefined {
  // 完全一致
  const directId = nameToIdMap.get(name);
  if (directId) return directId;

  // エイリアス経由
  const aliasName = NAME_ALIASES[name];
  if (aliasName) {
    return nameToIdMap.get(aliasName);
  }

  return undefined;
}

/**
 * 取得済みの画像IDを取得
 */
async function getExistingImageIds(outputDir: string): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const files = await fs.readdir(outputDir);
    for (const file of files) {
      if (file.endsWith(".jpg")) {
        const id = file.replace(".jpg", "");
        ids.add(id);
      }
    }
  } catch {
    // ディレクトリが存在しない場合は空セット
  }
  return ids;
}

/**
 * 画像をダウンロード
 */
async function downloadImage(
  url: string,
  outputPath: string,
  name: string,
  index?: number,
  total?: number
): Promise<void> {
  const prefix = index !== undefined && total !== undefined ? `[${index + 1}/${total}]` : "";
  const logPrefix = `[downloadImages]${prefix}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`${logPrefix} リトライ ${attempt}/${MAX_RETRIES}: ${name}`);
      }

      const response = await fetchWithTimeout(url, FETCH_TIMEOUT);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      await fs.writeFile(outputPath, Buffer.from(buffer));
      console.log(`${logPrefix} 保存完了: ${name}`);
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`${logPrefix} エラー発生 (attempt ${attempt}/${MAX_RETRIES}): ${errorMessage}`);

      if (attempt === MAX_RETRIES) {
        throw error;
      }

      const waitMs = attempt * 2000;
      console.log(`${logPrefix} ${waitMs}ms後にリトライ...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

interface DownloadTask {
  url: string;
  id: string;
  name: string;
}

async function main(): Promise<void> {
  console.log("[downloadImages] 開始");

  // 入力データを読み込み
  const imageJsonPath = path.join(DATA_DIR, "image.json");
  const idolsJsonPath = path.join(DATA_DIR, "idols.json");

  const [imageData, idolsData] = await Promise.all([
    fs.readFile(imageJsonPath, "utf-8").then((data) => JSON.parse(data) as ImageEntry[]),
    fs.readFile(idolsJsonPath, "utf-8").then((data) => JSON.parse(data) as ScrapeResult<Idol>),
  ]);

  console.log(`[downloadImages] 画像データ: ${imageData.length}件`);
  console.log(`[downloadImages] アイドルデータ: ${idolsData.count}件`);

  // 名前→IDマッピングを作成
  const nameToIdMap = buildNameToIdMap(idolsData.data);
  console.log(`[downloadImages] 名前→IDマッピング: ${nameToIdMap.size}件`);

  // 出力ディレクトリを作成
  await ensureDir(OUTPUT_DIR);

  // 取得済み画像を確認
  const existingIds = await getExistingImageIds(OUTPUT_DIR);
  console.log(`[downloadImages] 取得済み: ${existingIds.size}件`);

  // ダウンロードタスクを作成
  const tasks: DownloadTask[] = [];
  const notFoundNames: string[] = [];

  for (const entry of imageData) {
    const id = resolveIdolId(entry.name, nameToIdMap);
    if (!id) {
      notFoundNames.push(entry.name);
      continue;
    }
    if (existingIds.has(id)) {
      continue;
    }
    tasks.push({
      url: entry.img,
      id,
      name: entry.name,
    });
  }

  if (notFoundNames.length > 0) {
    console.warn(`[downloadImages] IDが見つからなかったアイドル: ${notFoundNames.length}件`);
    for (const name of notFoundNames) {
      console.warn(`  - ${name}`);
    }
  }

  console.log(`[downloadImages] ダウンロード対象: ${tasks.length}件`);

  if (tasks.length === 0) {
    console.log("[downloadImages] ダウンロード対象なし");
    return;
  }

  // バッチダウンロード
  const total = tasks.length;
  const totalBatches = Math.ceil(total / CONCURRENCY);
  let downloaded = 0;
  const failed: string[] = [];

  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batchIndex = Math.floor(i / CONCURRENCY) + 1;
    const batch = tasks.slice(i, i + CONCURRENCY);

    console.log(`[downloadImages] バッチ ${batchIndex}/${totalBatches} 開始 (${batch.length}件)`);
    const batchStartTime = Date.now();

    const results = await Promise.allSettled(
      batch.map((task, batchOffset) => {
        const outputPath = path.join(OUTPUT_DIR, `${task.id}.jpg`);
        return downloadImage(task.url, outputPath, task.name, i + batchOffset, total);
      })
    );

    for (const [j, result] of results.entries()) {
      if (result.status === "fulfilled") {
        downloaded++;
      } else {
        const task = batch[j];
        if (task) {
          failed.push(task.name);
        }
      }
    }

    const batchElapsed = ((Date.now() - batchStartTime) / 1000).toFixed(1);
    console.log(
      `[downloadImages] バッチ ${batchIndex}/${totalBatches} 完了 (${batchElapsed}秒), 累計${downloaded}/${total}件`
    );

    if (i + CONCURRENCY < tasks.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log(`[downloadImages] 完了: ${downloaded}件ダウンロード`);
  if (failed.length > 0) {
    console.error(`[downloadImages] 失敗: ${failed.length}件`);
    for (const name of failed) {
      console.error(`  - ${name}`);
    }
  }
}

main();

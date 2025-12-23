import type { Idol, IdolDetail, Brand } from "../types/index.ts";
import { JSDOM } from "jsdom";

const MAX_RETRIES = 3;
const FETCH_TIMEOUT = 30000;

/**
 * HTMLから随伴アイドル情報を抽出
 */
function extractRecommendedIdols(document: Document): Idol[] {
  const container = document.querySelector("ul.another-chara");
  if (!container) {
    return [];
  }

  const items = container.querySelectorAll("li");
  return Array.from(items).map((li) => {
    const anchor = li.querySelector("a");
    const paragraph = li.querySelector("p");

    const brand = Array.from(li.classList).filter(
      (cls) => cls !== "shadow" && cls !== "cell"
    ) as Brand[];

    // テキストノードから名前を抽出
    const textNodes = paragraph
      ? Array.from(paragraph.childNodes)
          .filter((node) => node.nodeType === 3) // Node.TEXT_NODE
          .map((node) => node.textContent?.trim() ?? "")
          .filter((text) => text.length > 0)
      : [];

    return {
      link: anchor?.href ?? "",
      brand,
      name: textNodes[0] ?? "",
    };
  });
}

/**
 * リンクからアイドルIDを抽出
 */
export function extractIdolId(link: string): string {
  const match = link.match(/\/detail\/(\d+)$/);
  return match?.[1] ?? "";
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

async function fetchSingleIdolDetail(
  idol: Idol,
  index?: number,
  total?: number
): Promise<IdolDetail> {
  const prefix = index !== undefined && total !== undefined ? `[${index + 1}/${total}]` : "";
  const logPrefix = `[fetchIdolDetails]${prefix}`;

  console.log(`${logPrefix} 取得開始: ${idol.name}`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`${logPrefix} リトライ ${attempt}/${MAX_RETRIES}`);
      }

      const response = await fetchWithTimeout(idol.link, FETCH_TIMEOUT);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const dom = new JSDOM(html, { url: idol.link });
      const document = dom.window.document;

      const recommended = extractRecommendedIdols(document);
      console.log(`${logPrefix} 取得完了: 随伴${recommended.length}件`);

      return {
        ...idol,
        recommended,
      };
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

  throw new Error("Unreachable");
}

export async function fetchIdolDetails(idol: Idol): Promise<IdolDetail> {
  return fetchSingleIdolDetail(idol);
}

export interface FetchAllIdolDetailsOptions {
  /** 並列数 */
  concurrency?: number;
  /** バッチ間の待機時間(ms) */
  delayMs?: number;
  /** 各アイドル取得完了時のコールバック */
  onIdolFetched?: (detail: IdolDetail, index: number, total: number) => Promise<void>;
  /** 取得済みIDのセット（スキップ用） */
  skipIds?: Set<string>;
}

/**
 * 複数アイドルの詳細を並列取得（レート制限付き）
 */
export async function fetchAllIdolDetails(
  idols: Idol[],
  options: FetchAllIdolDetailsOptions = {}
): Promise<IdolDetail[]> {
  const { concurrency = 3, delayMs = 500, onIdolFetched, skipIds } = options;

  // スキップ対象を除外
  const targetIdols = skipIds
    ? idols.filter((idol) => !skipIds.has(extractIdolId(idol.link)))
    : idols;

  const skippedCount = idols.length - targetIdols.length;
  if (skippedCount > 0) {
    console.log(`[fetchAllIdolDetails] ${skippedCount}件をスキップ（取得済み）`);
  }

  const total = targetIdols.length;
  if (total === 0) {
    console.log(`[fetchAllIdolDetails] 取得対象なし`);
    return [];
  }

  const totalBatches = Math.ceil(total / concurrency);

  console.log(
    `[fetchAllIdolDetails] 開始: 合計${total}件, 並列数${concurrency}, バッチ数${totalBatches}`
  );

  const results: IdolDetail[] = [];

  for (let i = 0; i < targetIdols.length; i += concurrency) {
    const batchIndex = Math.floor(i / concurrency) + 1;
    const batch = targetIdols.slice(i, i + concurrency);

    console.log(
      `[fetchAllIdolDetails] バッチ ${batchIndex}/${totalBatches} 開始 (${batch.length}件)`
    );
    const batchStartTime = Date.now();

    const batchResults = await Promise.all(
      batch.map((idol, batchOffset) => fetchSingleIdolDetail(idol, i + batchOffset, total))
    );

    // コールバックを呼び出し（あれば）
    if (onIdolFetched) {
      for (const [j, detail] of batchResults.entries()) {
        await onIdolFetched(detail, i + j, total);
      }
    }

    results.push(...batchResults);

    const batchElapsed = ((Date.now() - batchStartTime) / 1000).toFixed(1);
    console.log(
      `[fetchAllIdolDetails] バッチ ${batchIndex}/${totalBatches} 完了 (${batchElapsed}秒), 累計${results.length}/${total}件`
    );

    if (i + concurrency < targetIdols.length) {
      console.log(`[fetchAllIdolDetails] ${delayMs}ms待機中...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.log(`[fetchAllIdolDetails] 全バッチ完了: ${results.length}件`);
  return results;
}

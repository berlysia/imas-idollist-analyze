import type { Brand, ScrapeResult, IdolDetail } from "../types/index.ts";

/**
 * 正規化されたアイドル情報
 */
export interface NormalizedIdol {
  name: string;
  brand: Brand[];
  link: string;
}

/**
 * 正規化された共起データ
 */
export interface NormalizedData {
  scrapedAt: string;
  idols: Record<string, NormalizedIdol>;
  cooccurrences: Record<string, string[]>;
}

/**
 * リンクURLからIDを抽出
 * 例: "https://idollist.idolmaster-official.jp/search/detail/10001" -> "10001"
 */
function extractIdFromLink(link: string): string {
  const match = link.match(/\/(\d+)$/);
  if (!match || match[1] === undefined) {
    throw new Error(`Invalid link format: ${link}`);
  }
  return match[1];
}

/**
 * 詳細データを正規化された形式に変換
 */
export function normalizeDetails(data: ScrapeResult<IdolDetail>): NormalizedData {
  const idols: Record<string, NormalizedIdol> = {};
  const cooccurrences: Record<string, string[]> = {};

  for (const idol of data.data) {
    const id = extractIdFromLink(idol.link);

    idols[id] = {
      name: idol.name,
      brand: idol.brand,
      link: idol.link,
    };

    cooccurrences[id] = idol.cooccurring.map((cooccurring) => extractIdFromLink(cooccurring.link));

    // 共起アイドルの情報もidolsに追加（まだ存在しない場合）
    for (const cooccurring of idol.cooccurring) {
      const cooccurringId = extractIdFromLink(cooccurring.link);
      if (!idols[cooccurringId]) {
        idols[cooccurringId] = {
          name: cooccurring.name,
          brand: cooccurring.brand,
          link: cooccurring.link,
        };
      }
    }
  }

  return {
    scrapedAt: data.scrapedAt,
    idols,
    cooccurrences,
  };
}

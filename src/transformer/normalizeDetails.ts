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
 * 正規化された随伴データ
 */
export interface NormalizedData {
  scrapedAt: string;
  idols: Record<string, NormalizedIdol>;
  /** 随伴関係: キーのアイドルのページに掲載されているアイドルIDの配列 */
  accompaniments: Record<string, string[]>;
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
  const accompaniments: Record<string, string[]> = {};

  for (const idol of data.data) {
    const id = extractIdFromLink(idol.link);
    const accompanyingIdols = idol.accompanying;

    idols[id] = {
      name: idol.name,
      brand: idol.brand,
      link: idol.link,
    };

    accompaniments[id] = accompanyingIdols.map((acc) => extractIdFromLink(acc.link));

    // 随伴アイドルの情報もidolsに追加（まだ存在しない場合）
    for (const acc of accompanyingIdols) {
      const accompanyingId = extractIdFromLink(acc.link);
      if (!idols[accompanyingId]) {
        idols[accompanyingId] = {
          name: acc.name,
          brand: acc.brand,
          link: acc.link,
        };
      }
    }
  }

  return {
    scrapedAt: data.scrapedAt,
    idols,
    accompaniments,
  };
}

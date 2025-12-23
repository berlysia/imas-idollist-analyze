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
  recommendations: Record<string, string[]>;
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
  const recommendations: Record<string, string[]> = {};

  for (const idol of data.data) {
    const id = extractIdFromLink(idol.link);

    idols[id] = {
      name: idol.name,
      brand: idol.brand,
      link: idol.link,
    };

    recommendations[id] = idol.recommended.map((recommended) =>
      extractIdFromLink(recommended.link)
    );

    // 随伴アイドルの情報もidolsに追加（まだ存在しない場合）
    for (const recommended of idol.recommended) {
      const recommendedId = extractIdFromLink(recommended.link);
      if (!idols[recommendedId]) {
        idols[recommendedId] = {
          name: recommended.name,
          brand: recommended.brand,
          link: recommended.link,
        };
      }
    }
  }

  return {
    scrapedAt: data.scrapedAt,
    idols,
    recommendations,
  };
}

import type { Brand } from "@/types";

export interface IdolData {
  name: string;
  brand: Brand[];
  link: string;
}

export interface NormalizedData {
  scrapedAt: string;
  idols: Record<string, IdolData>;
  cooccurrences: Record<string, string[]>;
}

export interface CooccurrenceStats {
  id: string;
  name: string;
  brand: Brand[];
  count: number;
  byBrand: Record<Brand, number>;
}

export const BRAND_NAMES: Record<Brand, string> = {
  imas: "765PRO",
  deremas: "シンデレラ",
  milimas: "ミリオン",
  sidem: "SideM",
  shiny: "シャイニー",
  gakuen: "学マス",
};

export function getBrandName(brand: Brand): string {
  return BRAND_NAMES[brand];
}

/**
 * ペア単位の共起とPMI（Pointwise Mutual Information）
 * PMI = log2(P(A,B) / (P(A) * P(B)))
 * 高いPMI = 期待より多く共起している = 意外性のある関係
 */
export interface PairCooccurrence {
  idolA: { id: string; name: string; brand: Brand[] };
  idolB: { id: string; name: string; brand: Brand[] };
  /** 共起回数（双方向の合計） */
  count: number;
  /** PMI値 */
  pmi: number;
  /** ブランド横断かどうか */
  crossBrand: boolean;
}

/**
 * PMIベースの「意外性のある共起」を計算
 * @param minCount 最低共起数（統計的安定性のため）
 */
export function computePMIRanking(data: NormalizedData, minCount: number = 2): PairCooccurrence[] {
  const idolIds = Object.keys(data.idols);
  const totalIdols = idolIds.length;

  // 各アイドルの出現回数（他のアイドルから選ばれた回数 + 自分が選んだ回数）
  const appearanceCount = new Map<string, number>();
  for (const [sourceId, targetIds] of Object.entries(data.cooccurrences)) {
    // sourceは「選んだ側」としてカウント
    appearanceCount.set(sourceId, (appearanceCount.get(sourceId) ?? 0) + targetIds.length);
    // targetは「選ばれた側」としてカウント
    for (const targetId of targetIds) {
      appearanceCount.set(targetId, (appearanceCount.get(targetId) ?? 0) + 1);
    }
  }

  // ペア単位の共起回数を計算（双方向）
  const pairCount = new Map<string, number>();
  for (const [sourceId, targetIds] of Object.entries(data.cooccurrences)) {
    for (const targetId of targetIds) {
      // 順序を正規化してキーを作成（小さいID, 大きいID）
      const key = sourceId < targetId ? `${sourceId}|${targetId}` : `${targetId}|${sourceId}`;
      pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
    }
  }

  // 総共起数（PMI計算の分母用）
  const totalCooccurrences = Array.from(pairCount.values()).reduce((a, b) => a + b, 0);

  const results: PairCooccurrence[] = [];

  for (const [key, count] of pairCount.entries()) {
    if (count < minCount) continue;

    const parts = key.split("|");
    const idA = parts[0];
    const idB = parts[1];
    if (!idA || !idB) continue;

    const idolA = data.idols[idA];
    const idolB = data.idols[idB];
    if (!idolA || !idolB) continue;

    const countA = appearanceCount.get(idA) ?? 0;
    const countB = appearanceCount.get(idB) ?? 0;

    // P(A,B) = このペアの共起回数 / 総共起回数
    const pAB = count / totalCooccurrences;
    // P(A) = Aの出現回数 / (アイドル数 * 平均共起数)
    const pA = countA / (totalIdols * (totalCooccurrences / totalIdols));
    const pB = countB / (totalIdols * (totalCooccurrences / totalIdols));

    // PMI = log2(P(A,B) / (P(A) * P(B)))
    const pmi = Math.log2(pAB / (pA * pB));

    // ブランド横断判定
    const brandsA = new Set(idolA.brand);
    const brandsB = new Set(idolB.brand);
    const crossBrand = ![...brandsA].some((b) => brandsB.has(b));

    results.push({
      idolA: { id: idA, name: idolA.name, brand: idolA.brand },
      idolB: { id: idB, name: idolB.name, brand: idolB.brand },
      count,
      pmi,
      crossBrand,
    });
  }

  // PMIの高い順にソート
  return results.sort((a, b) => b.pmi - a.pmi);
}

/**
 * ブランド横断ペア: 異なるブランドの2人が、複数のアイドルから同時に共起として選ばれている
 */
export interface CrossBrandBridge {
  idolA: { id: string; name: string; brand: Brand[] };
  idolB: { id: string; name: string; brand: Brand[] };
  /** 同時に選んだアイドルの数 */
  voterCount: number;
  /** 同時に選んだアイドルのリスト */
  voters: Array<{ id: string; name: string; brand: Brand[] }>;
  /** PMI値: この2人が同時に選ばれる意外性 */
  pmi: number;
}

/**
 * ブランド横断で複数人から同時に選ばれているペアを計算（PMI付き）
 * @param minVoters 最低投票者数
 */
export function computeCrossBrandBridges(
  data: NormalizedData,
  minVoters: number = 2
): CrossBrandBridge[] {
  // 各アイドルが共起リストに現れる回数（被共起数）
  const appearanceCount = new Map<string, number>();
  for (const targetIds of Object.values(data.cooccurrences)) {
    for (const targetId of targetIds) {
      appearanceCount.set(targetId, (appearanceCount.get(targetId) ?? 0) + 1);
    }
  }

  // 総投票者数（共起リストを持つアイドルの数）
  const totalVoters = Object.keys(data.cooccurrences).length;

  // 各アイドルの共起リストに同時に現れるペアを記録
  const pairVoters = new Map<string, string[]>();

  for (const [sourceId, targetIds] of Object.entries(data.cooccurrences)) {
    for (let i = 0; i < targetIds.length; i++) {
      for (let j = i + 1; j < targetIds.length; j++) {
        const idA = targetIds[i];
        const idB = targetIds[j];
        if (!idA || !idB) continue;
        const key = idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;

        if (!pairVoters.has(key)) {
          pairVoters.set(key, []);
        }
        pairVoters.get(key)!.push(sourceId);
      }
    }
  }

  const results: CrossBrandBridge[] = [];

  for (const [key, voters] of pairVoters.entries()) {
    if (voters.length < minVoters) continue;

    const parts = key.split("|");
    const idA = parts[0];
    const idB = parts[1];
    if (!idA || !idB) continue;

    const idolA = data.idols[idA];
    const idolB = data.idols[idB];
    if (!idolA || !idolB) continue;

    // ブランド横断判定
    const brandsA = new Set(idolA.brand);
    const brandsB = new Set(idolB.brand);
    const isCrossBrand = ![...brandsA].some((b) => brandsB.has(b));

    if (!isCrossBrand) continue;

    // PMI計算
    // P(A,B) = このペアを同時に選んだ投票者数 / 総投票者数
    const pAB = voters.length / totalVoters;
    // P(A) = Aが選ばれた回数 / 総投票者数
    const countA = appearanceCount.get(idA) ?? 0;
    const countB = appearanceCount.get(idB) ?? 0;
    const pA = countA / totalVoters;
    const pB = countB / totalVoters;

    // PMI = log2(P(A,B) / (P(A) * P(B)))
    const pmi = pA > 0 && pB > 0 ? Math.log2(pAB / (pA * pB)) : 0;

    results.push({
      idolA: { id: idA, name: idolA.name, brand: idolA.brand },
      idolB: { id: idB, name: idolB.name, brand: idolB.brand },
      voterCount: voters.length,
      voters: voters.map((v) => {
        const idol = data.idols[v];
        return { id: v, name: idol?.name ?? v, brand: idol?.brand ?? [] };
      }),
      pmi,
    });
  }

  // デフォルトはPMI順
  return results.sort((a, b) => b.pmi - a.pmi);
}

export function computeIncomingStats(data: NormalizedData): CooccurrenceStats[] {
  const incomingCount = new Map<string, number>();
  const incomingByBrand = new Map<string, Record<Brand, number>>();

  for (const [sourceId, targetIds] of Object.entries(data.cooccurrences)) {
    const sourceIdol = data.idols[sourceId];
    if (!sourceIdol) continue;

    for (const targetId of targetIds) {
      incomingCount.set(targetId, (incomingCount.get(targetId) ?? 0) + 1);

      let byBrand = incomingByBrand.get(targetId);
      if (!byBrand) {
        byBrand = { imas: 0, deremas: 0, milimas: 0, sidem: 0, shiny: 0, gakuen: 0 };
        incomingByBrand.set(targetId, byBrand);
      }
      for (const brand of sourceIdol.brand) {
        byBrand[brand]++;
      }
    }
  }

  const stats: CooccurrenceStats[] = [];
  for (const [id, count] of incomingCount.entries()) {
    const idol = data.idols[id];
    if (!idol) continue;

    stats.push({
      id,
      name: idol.name,
      brand: idol.brand,
      count,
      byBrand: incomingByBrand.get(id) ?? {
        imas: 0,
        deremas: 0,
        milimas: 0,
        sidem: 0,
        shiny: 0,
        gakuen: 0,
      },
    });
  }

  return stats.sort((a, b) => b.count - a.count);
}

/**
 * アイドル詳細情報
 */
export interface IdolDetail {
  id: string;
  name: string;
  brand: Brand[];
  link: string;
  /** 自分が選んだ共起アイドル */
  selectedIdols: Array<{ id: string; name: string; brand: Brand[] }>;
  /** 自分を選んだアイドル */
  selectedBy: Array<{ id: string; name: string; brand: Brand[] }>;
  /** 相思相愛ペア（互いに選び合っている） */
  mutualPairs: Array<{ id: string; name: string; brand: Brand[]; pmi: number }>;
  /** ブランド横断ペア（異なるブランドのアイドルと同時に選ばれている） */
  crossBrandBridges: Array<{
    partner: { id: string; name: string; brand: Brand[] };
    voterCount: number;
    pmi: number;
    voters: Array<{ id: string; name: string; brand: Brand[] }>;
  }>;
  /** 被共起数 */
  incomingCount: number;
  /** ブランド別被共起数 */
  incomingByBrand: Record<Brand, number>;
}

/**
 * 特定アイドルの詳細情報を計算
 */
export function computeIdolDetail(
  data: NormalizedData,
  idolId: string,
  pmiPairs: PairCooccurrence[],
  crossBrandBridges: CrossBrandBridge[]
): IdolDetail | null {
  const idol = data.idols[idolId];
  if (!idol) return null;

  // 自分が選んだ共起アイドル
  const selectedIds = data.cooccurrences[idolId] ?? [];
  const selectedIdols = selectedIds
    .map((id) => {
      const i = data.idols[id];
      return i ? { id, name: i.name, brand: i.brand } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // 自分を選んだアイドル
  const selectedBy: Array<{ id: string; name: string; brand: Brand[] }> = [];
  for (const [sourceId, targetIds] of Object.entries(data.cooccurrences)) {
    if (targetIds.includes(idolId)) {
      const source = data.idols[sourceId];
      if (source) {
        selectedBy.push({ id: sourceId, name: source.name, brand: source.brand });
      }
    }
  }

  // 相思相愛ペア
  const mutualPairs = pmiPairs
    .filter((p) => p.idolA.id === idolId || p.idolB.id === idolId)
    .map((p) => {
      const partner = p.idolA.id === idolId ? p.idolB : p.idolA;
      return { ...partner, pmi: p.pmi };
    })
    .sort((a, b) => b.pmi - a.pmi);

  // ブランド横断ペア
  const bridges = crossBrandBridges
    .filter((b) => b.idolA.id === idolId || b.idolB.id === idolId)
    .map((b) => {
      const partner = b.idolA.id === idolId ? b.idolB : b.idolA;
      return {
        partner,
        voterCount: b.voterCount,
        pmi: b.pmi,
        voters: b.voters,
      };
    })
    .sort((a, b) => b.pmi - a.pmi);

  // 被共起数計算
  const incomingByBrand: Record<Brand, number> = {
    imas: 0,
    deremas: 0,
    milimas: 0,
    sidem: 0,
    shiny: 0,
    gakuen: 0,
  };
  for (const selector of selectedBy) {
    for (const brand of selector.brand) {
      incomingByBrand[brand]++;
    }
  }

  return {
    id: idolId,
    name: idol.name,
    brand: idol.brand,
    link: idol.link,
    selectedIdols,
    selectedBy,
    mutualPairs,
    crossBrandBridges: bridges,
    incomingCount: selectedBy.length,
    incomingByBrand,
  };
}

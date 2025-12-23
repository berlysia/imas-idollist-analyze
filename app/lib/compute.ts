import type { Brand } from "@/types";
import { BRAND_NAMES } from "./constants";

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
 * 選択に関するスコア群
 */
export interface SelectionScore {
  /** IDF: log2(totalVoters / incomingCount) - 高いほど珍しい選択 */
  idf: number;
  /** IDF偏差: 選んでくれたアイドルの選択リスト内での珍しさ（自分のIDF - 選択リストの平均IDF） */
  idfDeviation?: number;
  /** 選択リスト内での順位（1が最も珍しい、6が最も人気） */
  rank?: number;
}

/**
 * アイドル詳細情報
 */
export interface IdolDetail {
  id: string;
  name: string;
  brand: Brand[];
  link: string;
  /** 自分が選んだ共起アイドル（スコア付き） */
  selectedIdols: Array<{ id: string; name: string; brand: Brand[]; score: SelectionScore }>;
  /** 自分を選んだアイドル（スコア付き） */
  selectedBy: Array<{ id: string; name: string; brand: Brand[]; score: SelectionScore }>;
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
 * IDF計算用コンテキスト
 * IDF = log2(totalVoters / incomingCount(target))
 * 人気で選ばれたのではなく、特別に選んだことを示す指標
 */
function computeIDFContext(data: NormalizedData): {
  incomingCount: Map<string, number>;
  totalVoters: number;
} {
  const incomingCount = new Map<string, number>();
  let totalVoters = 0;

  for (const [, targetIds] of Object.entries(data.cooccurrences)) {
    totalVoters++;
    for (const targetId of targetIds) {
      incomingCount.set(targetId, (incomingCount.get(targetId) ?? 0) + 1);
    }
  }

  return {
    incomingCount,
    totalVoters,
  };
}

/**
 * IDF計算: targetがどれだけ珍しい選択か
 * 高IDF = あまり選ばれない相手を選んでいる（珍しい選択）
 * 低IDF = 多くの人が選ぶ人気アイドルを選んでいる
 */
function computeIDF(targetId: string, context: ReturnType<typeof computeIDFContext>): number {
  const { incomingCount, totalVoters } = context;
  const count = incomingCount.get(targetId) ?? 0;
  if (count === 0) return 0;
  return Math.log2(totalVoters / count);
}

/**
 * クラスタ検出用の重み付きエッジ
 */
export interface WeightedEdge {
  source: string;
  target: string;
  /** 双方向性（1=片方向、2=相互選択） */
  directionality: number;
  /** IDF補正済み重み */
  weight: number;
}

/**
 * クラスタメンバーの役割
 */
export interface ClusterMember {
  id: string;
  name: string;
  brand: Brand[];
  /** コア度（0-1、高いほど中心的） */
  coreness: number;
  /** クラスタ内の次数（エッジ数） */
  degree: number;
  /** クラスタ内の重み合計 */
  weightSum: number;
  /** 役割: core=密に結合、peripheral=コアに接続 */
  role: "core" | "peripheral";
}

/**
 * 検出されたクラスタ
 */
export interface Cluster {
  /** クラスタID */
  id: number;
  /** メンバーのアイドルID */
  members: string[];
  /** メンバー情報（後方互換用） */
  memberDetails: Array<{ id: string; name: string; brand: Brand[] }>;
  /** メンバー情報（役割付き） */
  memberRoles: ClusterMember[];
  /** コアメンバーのID */
  coreMembers: string[];
  /** 周辺メンバーのID */
  peripheralMembers: string[];
  /** クラスタ内の総重み */
  totalWeight: number;
  /** クラスタ内の密度（実際のエッジ数 / 可能なエッジ数） */
  density: number;
  /** コア部分の密度 */
  coreDensity: number;
  /** 主要ブランド */
  dominantBrands: Brand[];
  /** クラスタ内エッジ */
  edges: WeightedEdge[];
}

/**
 * IDF考慮の重み付きグラフを構築
 * 珍しい選択（高IDF）を重視する
 */
export function buildWeightedGraph(data: NormalizedData): {
  edges: WeightedEdge[];
  idfMap: Map<string, number>;
} {
  const idfContext = computeIDFContext(data);
  const idfMap = new Map<string, number>();

  // 全アイドルのIDFを計算
  for (const id of Object.keys(data.idols)) {
    idfMap.set(id, computeIDF(id, idfContext));
  }

  // 有向エッジを収集
  const directedEdges = new Map<string, { source: string; target: string }>();
  for (const [sourceId, targetIds] of Object.entries(data.cooccurrences)) {
    for (const targetId of targetIds) {
      const key = `${sourceId}|${targetId}`;
      directedEdges.set(key, { source: sourceId, target: targetId });
    }
  }

  // 無向エッジに変換し、重みを計算
  const edgeMap = new Map<string, WeightedEdge>();

  for (const [sourceId, targetIds] of Object.entries(data.cooccurrences)) {
    for (const targetId of targetIds) {
      // 正規化されたキー（小さいID|大きいID）
      const key = sourceId < targetId ? `${sourceId}|${targetId}` : `${targetId}|${sourceId}`;

      if (!edgeMap.has(key)) {
        // 双方向性チェック
        const reverseKey = `${targetId}|${sourceId}`;
        const isBidirectional = directedEdges.has(reverseKey);
        const directionality = isBidirectional ? 2 : 1;

        // IDF補正: 珍しい選択ほど高い重み
        // source→targetのエッジでは、targetのIDFを使用
        // 双方向の場合は両方のIDFの平均
        const idfSource = idfMap.get(sourceId) ?? 0;
        const idfTarget = idfMap.get(targetId) ?? 0;
        const idfWeight = isBidirectional ? (idfSource + idfTarget) / 2 : idfTarget;

        // 最終重み = 方向性スコア × IDF補正
        // IDFが0の場合（被選択数が総投票者数と同じ）でも最低限の重みを確保
        const weight = directionality * Math.max(idfWeight, 0.1);

        // 片方向の場合は実際の方向を保持（sourceが選択者、targetが被選択者）
        // 双方向の場合はIDでソートして正規化
        edgeMap.set(key, {
          source: isBidirectional ? (sourceId < targetId ? sourceId : targetId) : sourceId,
          target: isBidirectional ? (sourceId < targetId ? targetId : sourceId) : targetId,
          directionality,
          weight,
        });
      }
    }
  }

  return {
    edges: Array.from(edgeMap.values()),
    idfMap,
  };
}

/**
 * Louvain法によるコミュニティ検出
 * 重み付きモジュラリティを最大化
 */
export function detectClusters(
  data: NormalizedData,
  options: {
    /** 最小クラスタサイズ（デフォルト: 3） */
    minSize?: number;
    /** 最小密度（デフォルト: 0.3） */
    minDensity?: number;
    /** 解像度パラメータ（大きいほど小さいクラスタ、デフォルト: 1.0） */
    resolution?: number;
  } = {}
): Cluster[] {
  const { minSize = 3, minDensity = 0.3, resolution = 1.0 } = options;

  const { edges, idfMap: _idfMap } = buildWeightedGraph(data);

  // ノードリスト
  const nodeSet = new Set<string>();
  for (const edge of edges) {
    nodeSet.add(edge.source);
    nodeSet.add(edge.target);
  }
  const nodes = Array.from(nodeSet);

  // 隣接リスト（重み付き）
  const adjacency = new Map<string, Map<string, number>>();
  for (const node of nodes) {
    adjacency.set(node, new Map());
  }
  for (const edge of edges) {
    adjacency.get(edge.source)!.set(edge.target, edge.weight);
    adjacency.get(edge.target)!.set(edge.source, edge.weight);
  }

  // 総重み
  const totalWeight = edges.reduce((sum, e) => sum + e.weight, 0);
  if (totalWeight === 0) return [];

  // 各ノードの重み合計
  const nodeWeights = new Map<string, number>();
  for (const node of nodes) {
    let sum = 0;
    for (const w of adjacency.get(node)!.values()) {
      sum += w;
    }
    nodeWeights.set(node, sum);
  }

  // 初期コミュニティ割り当て（各ノードが独自のコミュニティ）
  const community = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) {
    community.set(nodes[i]!, i);
  }

  // Louvainアルゴリズムのメインループ
  let improved = true;
  let iteration = 0;
  const maxIterations = 100;

  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;

    for (const node of nodes) {
      const currentCommunity = community.get(node)!;
      const nodeWeight = nodeWeights.get(node)!;

      // 隣接コミュニティとその内部重みを計算
      const neighborCommunities = new Map<number, number>();
      for (const [neighbor, weight] of adjacency.get(node)!) {
        const neighborComm = community.get(neighbor)!;
        neighborCommunities.set(
          neighborComm,
          (neighborCommunities.get(neighborComm) ?? 0) + weight
        );
      }

      // 現在のコミュニティから削除した場合のモジュラリティ変化
      const currentCommWeight = neighborCommunities.get(currentCommunity) ?? 0;

      // コミュニティ内の総重み
      const commWeights = new Map<number, number>();
      for (const [n, c] of community) {
        commWeights.set(c, (commWeights.get(c) ?? 0) + nodeWeights.get(n)!);
      }

      let bestCommunity = currentCommunity;
      let bestDelta = 0;

      for (const [targetComm, edgeWeight] of neighborCommunities) {
        if (targetComm === currentCommunity) continue;

        const targetCommWeight = commWeights.get(targetComm) ?? 0;
        const currentCommTotalWeight = commWeights.get(currentCommunity) ?? 0;

        // モジュラリティ変化の計算
        const delta =
          resolution *
          (edgeWeight -
            currentCommWeight -
            (nodeWeight * (targetCommWeight - currentCommTotalWeight + nodeWeight)) /
              (2 * totalWeight));

        if (delta > bestDelta) {
          bestDelta = delta;
          bestCommunity = targetComm;
        }
      }

      if (bestCommunity !== currentCommunity) {
        community.set(node, bestCommunity);
        improved = true;
      }
    }
  }

  // コミュニティをクラスタに変換
  const clusterMembers = new Map<number, string[]>();
  for (const [node, comm] of community) {
    if (!clusterMembers.has(comm)) {
      clusterMembers.set(comm, []);
    }
    clusterMembers.get(comm)!.push(node);
  }

  // クラスタ情報を構築
  const clusters: Cluster[] = [];
  let clusterId = 0;

  for (const [, members] of clusterMembers) {
    if (members.length < minSize) continue;

    // クラスタ内エッジ
    const memberSet = new Set(members);
    const clusterEdges = edges.filter((e) => memberSet.has(e.source) && memberSet.has(e.target));

    // 密度計算
    const possibleEdges = (members.length * (members.length - 1)) / 2;
    const density = possibleEdges > 0 ? clusterEdges.length / possibleEdges : 0;

    if (density < minDensity) continue;

    // 総重み
    const totalClusterWeight = clusterEdges.reduce((sum, e) => sum + e.weight, 0);

    // メンバーごとの次数と重み合計を計算
    const memberDegree = new Map<string, number>();
    const memberWeightSum = new Map<string, number>();
    for (const memberId of members) {
      memberDegree.set(memberId, 0);
      memberWeightSum.set(memberId, 0);
    }
    for (const edge of clusterEdges) {
      memberDegree.set(edge.source, (memberDegree.get(edge.source) ?? 0) + 1);
      memberDegree.set(edge.target, (memberDegree.get(edge.target) ?? 0) + 1);
      memberWeightSum.set(edge.source, (memberWeightSum.get(edge.source) ?? 0) + edge.weight);
      memberWeightSum.set(edge.target, (memberWeightSum.get(edge.target) ?? 0) + edge.weight);
    }

    // コア度を計算: 次数と重みを正規化して組み合わせ
    const maxDegree = Math.max(...Array.from(memberDegree.values()), 1);
    const maxWeight = Math.max(...Array.from(memberWeightSum.values()), 1);

    const memberCoreness = new Map<string, number>();
    for (const memberId of members) {
      const degree = memberDegree.get(memberId) ?? 0;
      const weightSum = memberWeightSum.get(memberId) ?? 0;
      // コア度 = (正規化次数 + 正規化重み) / 2
      const coreness = (degree / maxDegree + weightSum / maxWeight) / 2;
      memberCoreness.set(memberId, coreness);
    }

    // コア/周辺を判定: コア度が中央値以上ならコア
    const corenessValues = Array.from(memberCoreness.values()).sort((a, b) => b - a);
    const medianIndex = Math.floor(corenessValues.length / 2);
    const coreThreshold = corenessValues[medianIndex] ?? 0.5;

    const coreMembers: string[] = [];
    const peripheralMembers: string[] = [];
    const memberRoles: ClusterMember[] = [];

    for (const memberId of members) {
      const idol = data.idols[memberId];
      if (!idol) continue;

      const coreness = memberCoreness.get(memberId) ?? 0;
      const degree = memberDegree.get(memberId) ?? 0;
      const weightSum = memberWeightSum.get(memberId) ?? 0;
      const role = coreness >= coreThreshold ? "core" : "peripheral";

      if (role === "core") {
        coreMembers.push(memberId);
      } else {
        peripheralMembers.push(memberId);
      }

      memberRoles.push({
        id: memberId,
        name: idol.name,
        brand: idol.brand,
        coreness,
        degree,
        weightSum,
        role,
      });
    }

    // コア度の降順でソート
    memberRoles.sort((a, b) => b.coreness - a.coreness);

    // コア部分の密度を計算
    const coreEdges = clusterEdges.filter(
      (e) => coreMembers.includes(e.source) && coreMembers.includes(e.target)
    );
    const possibleCoreEdges = (coreMembers.length * (coreMembers.length - 1)) / 2;
    const coreDensity = possibleCoreEdges > 0 ? coreEdges.length / possibleCoreEdges : 0;

    // 主要ブランド
    const brandCounts = new Map<Brand, number>();
    for (const memberId of members) {
      const idol = data.idols[memberId];
      if (idol) {
        for (const brand of idol.brand) {
          brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1);
        }
      }
    }
    const dominantBrands = Array.from(brandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([brand]) => brand);

    // メンバー詳細（後方互換用）
    const memberDetails = members
      .map((id) => {
        const idol = data.idols[id];
        return idol ? { id, name: idol.name, brand: idol.brand } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    clusters.push({
      id: clusterId++,
      members,
      memberDetails,
      memberRoles,
      coreMembers,
      peripheralMembers,
      totalWeight: totalClusterWeight,
      density,
      coreDensity,
      dominantBrands,
      edges: clusterEdges,
    });
  }

  // 総重みの降順でソート
  return clusters.sort((a, b) => b.totalWeight - a.totalWeight);
}

export function computeIdolDetail(
  data: NormalizedData,
  idolId: string,
  pmiPairs: PairCooccurrence[],
  crossBrandBridges: CrossBrandBridge[]
): IdolDetail | null {
  const idol = data.idols[idolId];
  if (!idol) return null;

  // IDF計算用コンテキスト
  const idfContext = computeIDFContext(data);

  // 自分が選んだ共起アイドル（スコア付き、元の順序を維持）
  const selectedIds = data.cooccurrences[idolId] ?? [];
  const selectedIdols = selectedIds
    .map((id) => {
      const i = data.idols[id];
      if (!i) return null;
      const idf = computeIDF(id, idfContext);
      return { id, name: i.name, brand: i.brand, score: { idf } };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // 自分を選んだアイドル（相対IDF = 選択リスト内での自分の珍しさ、ランク付き）
  const selectedBy: Array<{ id: string; name: string; brand: Brand[]; score: SelectionScore }> = [];
  const myIdf = computeIDF(idolId, idfContext);
  for (const [sourceId, targetIds] of Object.entries(data.cooccurrences)) {
    if (targetIds.includes(idolId)) {
      const source = data.idols[sourceId];
      if (source) {
        // 選んでくれたアイドルの選択リスト全体のIDFを計算
        const selectionIdfs = targetIds.map((tid) => computeIDF(tid, idfContext));
        const avgIdf = selectionIdfs.reduce((a, b) => a + b, 0) / selectionIdfs.length;
        // IDF偏差 = 自分のIDF - 選択リストの平均IDF
        const idfDeviation = myIdf - avgIdf;
        // 選択リスト内での順位（IDFが高い順 = 珍しい順）
        const sortedIdfs = [...selectionIdfs].sort((a, b) => b - a);
        const rank = sortedIdfs.indexOf(myIdf) + 1;
        selectedBy.push({
          id: sourceId,
          name: source.name,
          brand: source.brand,
          score: { idf: myIdf, idfDeviation, rank },
        });
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

/**
 * ブランド横断クラスタ: cross-brand bridgesのみからグラフを構築
 */
export interface CrossBrandCluster {
  id: number;
  members: string[];
  memberDetails: Array<{ id: string; name: string; brand: Brand[] }>;
  /** クラスタ内のブランド横断エッジ */
  edges: Array<{
    idolA: { id: string; name: string; brand: Brand[] };
    idolB: { id: string; name: string; brand: Brand[] };
    voterCount: number;
    pmi: number;
    /** このペアを同時に共起として選出したアイドル */
    voters: Array<{ id: string; name: string; brand: Brand[] }>;
  }>;
  /** 総投票者数（重複除去） */
  totalVoterCount: number;
  /** 平均PMI */
  avgPmi: number;
  /** 含まれるブランドの種類 */
  brands: Brand[];
  /** ブランド数 */
  brandCount: number;
}

/**
 * ブランド横断ペアのみでクラスタを検出
 * 異なるブランドを繋ぐコミュニティを発見する
 */
export function detectCrossBrandClusters(
  data: NormalizedData,
  crossBrandBridges: CrossBrandBridge[],
  options: {
    /** 最小クラスタサイズ（デフォルト: 3） */
    minSize?: number;
    /** 最小エッジ数（デフォルト: 2） */
    minEdges?: number;
    /** 最小PMI閾値（これ以上のPMIを持つエッジのみ使用、デフォルト: 中央値） */
    minPmi?: number;
  } = {}
): CrossBrandCluster[] {
  const { minSize = 3, minEdges = 2 } = options;

  if (crossBrandBridges.length === 0) return [];

  // PMI閾値を計算（指定がなければ中央値を使用）
  const sortedPmis = crossBrandBridges.map((b) => b.pmi).sort((a, b) => a - b);
  const medianPmi = sortedPmis[Math.floor(sortedPmis.length / 2)] ?? 0;
  const minPmi = options.minPmi ?? medianPmi;

  // PMI閾値でフィルタ（意外性のある関係のみ抽出）
  const filteredBridges = crossBrandBridges.filter((b) => b.pmi >= minPmi);

  if (filteredBridges.length === 0) return [];

  // 正規化用の最大値を計算
  const maxVoterCount = Math.max(...filteredBridges.map((b) => b.voterCount), 1);
  const maxPmi = Math.max(...filteredBridges.map((b) => b.pmi), 1);

  // 正規化した投票数とPMIを組み合わせた重みを計算
  const getWeight = (voterCount: number, pmi: number) => {
    const normVoter = voterCount / maxVoterCount;
    const normPmi = pmi / maxPmi;
    return normVoter * 0.6 + normPmi * 0.4;
  };

  // ブランド横断ペアからグラフを構築
  // 重み = 投票数(60%) + PMI(40%) の組み合わせ
  const adjacency = new Map<string, Map<string, number>>();
  const nodeSet = new Set<string>();

  for (const bridge of filteredBridges) {
    const { idolA, idolB, voterCount, pmi } = bridge;
    const weight = getWeight(voterCount, pmi);
    nodeSet.add(idolA.id);
    nodeSet.add(idolB.id);

    if (!adjacency.has(idolA.id)) adjacency.set(idolA.id, new Map());
    if (!adjacency.has(idolB.id)) adjacency.set(idolB.id, new Map());

    adjacency.get(idolA.id)!.set(idolB.id, weight);
    adjacency.get(idolB.id)!.set(idolA.id, weight);
  }

  const nodes = Array.from(nodeSet);
  if (nodes.length < minSize) return [];

  // 総重み
  const totalWeight = filteredBridges.reduce((sum, b) => sum + getWeight(b.voterCount, b.pmi), 0);
  if (totalWeight === 0) return [];

  // 各ノードの重み合計
  const nodeWeights = new Map<string, number>();
  for (const node of nodes) {
    let sum = 0;
    for (const w of adjacency.get(node)?.values() ?? []) {
      sum += w;
    }
    nodeWeights.set(node, sum);
  }

  // 初期コミュニティ割り当て
  const community = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) {
    community.set(nodes[i]!, i);
  }

  // Louvainアルゴリズム
  let improved = true;
  let iteration = 0;
  const maxIterations = 100;
  const resolution = 1.0;

  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;

    for (const node of nodes) {
      const currentCommunity = community.get(node)!;
      const nodeWeight = nodeWeights.get(node)!;

      const neighborCommunities = new Map<number, number>();
      for (const [neighbor, weight] of adjacency.get(node) ?? []) {
        const neighborComm = community.get(neighbor)!;
        neighborCommunities.set(
          neighborComm,
          (neighborCommunities.get(neighborComm) ?? 0) + weight
        );
      }

      const currentCommWeight = neighborCommunities.get(currentCommunity) ?? 0;

      const commWeights = new Map<number, number>();
      for (const [n, c] of community) {
        commWeights.set(c, (commWeights.get(c) ?? 0) + nodeWeights.get(n)!);
      }

      let bestCommunity = currentCommunity;
      let bestDelta = 0;

      for (const [targetComm, edgeWeight] of neighborCommunities) {
        if (targetComm === currentCommunity) continue;

        const targetCommWeight = commWeights.get(targetComm) ?? 0;
        const currentCommTotalWeight = commWeights.get(currentCommunity) ?? 0;

        const delta =
          resolution *
          (edgeWeight -
            currentCommWeight -
            (nodeWeight * (targetCommWeight - currentCommTotalWeight + nodeWeight)) /
              (2 * totalWeight));

        if (delta > bestDelta) {
          bestDelta = delta;
          bestCommunity = targetComm;
        }
      }

      if (bestCommunity !== currentCommunity) {
        community.set(node, bestCommunity);
        improved = true;
      }
    }
  }

  // コミュニティをクラスタに変換
  const clusterMembers = new Map<number, string[]>();
  for (const [node, comm] of community) {
    if (!clusterMembers.has(comm)) {
      clusterMembers.set(comm, []);
    }
    clusterMembers.get(comm)!.push(node);
  }

  // クラスタ情報を構築
  const clusters: CrossBrandCluster[] = [];
  let clusterId = 0;

  for (const [, members] of clusterMembers) {
    if (members.length < minSize) continue;

    const memberSet = new Set(members);

    // クラスタ内のブランド横断エッジ（フィルタ済みのものを使用）
    const clusterEdges = filteredBridges.filter(
      (b) => memberSet.has(b.idolA.id) && memberSet.has(b.idolB.id)
    );

    if (clusterEdges.length < minEdges) continue;

    // メンバー詳細
    const memberDetails = members
      .map((id) => {
        const idol = data.idols[id];
        return idol ? { id, name: idol.name, brand: idol.brand } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // 総投票者数（重複除去）
    const allVoters = new Set<string>();
    for (const edge of clusterEdges) {
      for (const voter of edge.voters) {
        allVoters.add(voter.id);
      }
    }

    // 平均PMI
    const avgPmi = clusterEdges.reduce((sum, e) => sum + e.pmi, 0) / clusterEdges.length;

    // 含まれるブランド
    const brandSet = new Set<Brand>();
    for (const member of memberDetails) {
      for (const brand of member.brand) {
        brandSet.add(brand);
      }
    }
    const brands = Array.from(brandSet);

    clusters.push({
      id: clusterId++,
      members,
      memberDetails,
      edges: clusterEdges.map((e) => ({
        idolA: e.idolA,
        idolB: e.idolB,
        voterCount: e.voterCount,
        pmi: e.pmi,
        voters: e.voters,
      })),
      totalVoterCount: allVoters.size,
      avgPmi,
      brands,
      brandCount: brands.length,
    });
  }

  // ブランド数 × 総投票者数でソート（多様なブランドを繋ぐクラスタを優先）
  return clusters.sort((a, b) => {
    const scoreA = a.brandCount * a.totalVoterCount;
    const scoreB = b.brandCount * b.totalVoterCount;
    return scoreB - scoreA;
  });
}

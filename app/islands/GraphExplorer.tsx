import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Brand } from "../types";
import { EmptyMessage } from "../components/shared";
import GraphExplorerGraph from "./GraphExplorerGraph";
import AccompanimentPanel from "./AccompanimentPanel";
import NodeSelector, { getSelectionUrlParams, parseSelectionFromUrl } from "./NodeSelector";
import ModeToggleLink from "./ModeToggleLink";
import type {
  IdolListItem,
  ExplorerNode,
  ExplorerEdge,
  CooccurrenceCompanionPairData,
  SimilarByAccompanimentPairData,
  EdgeVisibility,
  ExplorerMode,
} from "./graphExplorerTypes";
export type { IdolListItem, ExplorerNode, ExplorerEdge, ExplorerMode } from "./graphExplorerTypes";

interface Props {
  idolList: IdolListItem[];
  accompaniments: Record<string, string[]>;
  idols: Record<string, { name: string; brand: Brand[]; kana: string }>;
  idfMap: Record<string, number>;
  pmiMap: Record<string, number>;
  cooccurrenceCompanionPairs: CooccurrenceCompanionPairData[];
  similarByAccompanimentPairs: SimilarByAccompanimentPairData[];
  /** @deprecated mode is now managed internally via URL param */
  mode?: ExplorerMode;
}

const BRAND_LIST: Brand[] = ["imas", "deremas", "milimas", "sidem", "shiny", "gakuen"];

function getIdolsByBrand(
  idols: Record<string, { name: string; brand: Brand[]; kana: string }>,
  brand: Brand
): Map<string, ExplorerNode> {
  const nodeMap = new Map<string, ExplorerNode>();
  for (const [id, idol] of Object.entries(idols)) {
    if (idol.brand.includes(brand)) {
      nodeMap.set(id, {
        id,
        name: idol.name,
        brand: idol.brand,
      });
    }
  }
  return nodeMap;
}

function getInitialNodesFromUrl(
  idols: Record<string, { name: string; brand: Brand[]; kana: string }>
): Map<string, ExplorerNode> {
  if (typeof window === "undefined") return new Map();

  const params = new URLSearchParams(window.location.search);

  // preset=all: 全アイドルを初期表示
  // preset=imas, preset=deremas, etc.: ブランド別
  const presetParam = params.get("preset");
  if (presetParam === "all") {
    const nodeMap = new Map<string, ExplorerNode>();
    for (const [id, idol] of Object.entries(idols)) {
      nodeMap.set(id, {
        id,
        name: idol.name,
        brand: idol.brand,
      });
    }
    return nodeMap;
  }

  if (presetParam && BRAND_LIST.includes(presetParam as Brand)) {
    return getIdolsByBrand(idols, presetParam as Brand);
  }

  // ids: 個別指定
  const idsParam = params.get("ids");
  if (!idsParam) return new Map();

  const nodeMap = new Map<string, ExplorerNode>();
  const ids = idsParam.split(",").filter((id) => id && idols[id]);

  for (const id of ids) {
    const idol = idols[id];
    if (idol) {
      nodeMap.set(id, {
        id,
        name: idol.name,
        brand: idol.brand,
      });
    }
  }

  return nodeMap;
}

function calculateEdgesForNodes(
  nodes: Map<string, ExplorerNode>,
  accompaniments: Record<string, string[]>,
  options?: {
    mutualOnly?: boolean;
    minIdf?: number;
    idfMap?: Record<string, number>;
  }
): Map<string, ExplorerEdge> {
  const edgeMap = new Map<string, ExplorerEdge>();
  const nodeIds = Array.from(nodes.keys());
  const { mutualOnly = false, minIdf = 0, idfMap = {} } = options ?? {};

  for (let i = 0; i < nodeIds.length; i++) {
    const idA = nodeIds[i];
    if (!idA) continue;
    const accompA = accompaniments[idA] ?? [];

    for (let j = i + 1; j < nodeIds.length; j++) {
      const idB = nodeIds[j];
      if (!idB) continue;
      const accompB = accompaniments[idB] ?? [];

      const aToB = accompA.includes(idB);
      const bToA = accompB.includes(idA);

      if (aToB || bToA) {
        const isMutual = aToB && bToA;

        // 相互のみフィルター
        if (mutualOnly && !isMutual) continue;

        // IDF閾値フィルター（両端のIDFの最小値を使用）
        if (minIdf > 0) {
          const idfA = idfMap[idA] ?? 0;
          const idfB = idfMap[idB] ?? 0;
          const edgeIdf = Math.min(idfA, idfB);
          if (edgeIdf < minIdf) continue;
        }

        const edgeKey = idA < idB ? `accomp:${idA}|${idB}` : `accomp:${idB}|${idA}`;
        const source = aToB ? idA : idB;
        const target = aToB ? idB : idA;

        edgeMap.set(edgeKey, {
          source,
          target,
          isMutual,
          weight: isMutual ? 1 : 0.5,
          edgeType: "accompaniment",
        });
      }
    }
  }

  return edgeMap;
}

function calculateCooccurrenceEdgesForNodes(
  nodes: Map<string, ExplorerNode>,
  cooccurrenceCompanionPairs: CooccurrenceCompanionPairData[],
  minPmi: number,
  minCooccurrenceSourceCount: number
): Map<string, ExplorerEdge> {
  const edgeMap = new Map<string, ExplorerEdge>();
  const nodeIds = new Set(nodes.keys());

  for (const pair of cooccurrenceCompanionPairs) {
    if (!nodeIds.has(pair.idolA.id) || !nodeIds.has(pair.idolB.id)) continue;
    if (pair.pmi < minPmi) continue;
    if (pair.cooccurrenceSourceCount < minCooccurrenceSourceCount) continue;

    const edgeKey =
      pair.idolA.id < pair.idolB.id
        ? `cooc:${pair.idolA.id}|${pair.idolB.id}`
        : `cooc:${pair.idolB.id}|${pair.idolA.id}`;

    edgeMap.set(edgeKey, {
      source: pair.idolA.id,
      target: pair.idolB.id,
      isMutual: true,
      weight: pair.cooccurrenceSourceCount / 10,
      pmi: pair.pmi,
      cooccurrenceSourceCount: pair.cooccurrenceSourceCount,
      edgeType: "cooccurrenceCompanion",
    });
  }

  return edgeMap;
}

function calculateSimilarByAccompanimentEdgesForNodes(
  nodes: Map<string, ExplorerNode>,
  similarByAccompanimentPairs: SimilarByAccompanimentPairData[],
  minCommonAccompanimentCount: number,
  minRareScore: number
): Map<string, ExplorerEdge> {
  const edgeMap = new Map<string, ExplorerEdge>();
  const nodeIds = new Set(nodes.keys());

  for (const pair of similarByAccompanimentPairs) {
    if (!nodeIds.has(pair.idolA.id) || !nodeIds.has(pair.idolB.id)) continue;
    if (pair.commonAccompanimentCount < minCommonAccompanimentCount) continue;
    if (pair.rareScore < minRareScore) continue;

    const edgeKey =
      pair.idolA.id < pair.idolB.id
        ? `similar:${pair.idolA.id}|${pair.idolB.id}`
        : `similar:${pair.idolB.id}|${pair.idolA.id}`;

    edgeMap.set(edgeKey, {
      source: pair.idolA.id,
      target: pair.idolB.id,
      isMutual: true,
      weight: pair.commonAccompanimentCount / 6,
      commonAccompanimentCount: pair.commonAccompanimentCount,
      rareScore: pair.rareScore,
      edgeType: "similarByAccompaniment",
    });
  }

  return edgeMap;
}

function getModeFromUrl(): ExplorerMode {
  if (typeof window === "undefined") return "topdown";
  const params = new URLSearchParams(window.location.search);
  const modeParam = params.get("mode");
  return modeParam === "bottomup" ? "bottomup" : "topdown";
}

export default function GraphExplorer({
  idolList,
  accompaniments,
  idols,
  idfMap,
  pmiMap,
  cooccurrenceCompanionPairs,
  similarByAccompanimentPairs,
  mode: modeProp,
}: Props) {
  // mode is managed internally via URL param, prop is deprecated
  const [mode, setMode] = useState<ExplorerMode>(() => modeProp ?? getModeFromUrl());
  // 選択されたアイドルIDのセット（NodeSelectorと同期）
  const initialSelectedIds = useMemo(() => {
    if (typeof window === "undefined") return new Set<string>();
    const params = new URLSearchParams(window.location.search);
    return parseSelectionFromUrl(params, idolList);
  }, [idolList]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => initialSelectedIds);

  // 選択IDからノードマップを生成
  const nodesFromSelection = useMemo(() => {
    const nodeMap = new Map<string, ExplorerNode>();
    for (const id of selectedIds) {
      const idol = idols[id];
      if (idol) {
        nodeMap.set(id, {
          id,
          name: idol.name,
          brand: idol.brand,
        });
      }
    }
    return nodeMap;
  }, [selectedIds, idols]);

  // 初期ノードを取得（後方互換性のため残す）
  const initialNodes = useMemo(() => getInitialNodesFromUrl(idols), [idols]);

  const [nodes, setNodes] = useState<Map<string, ExplorerNode>>(() =>
    nodesFromSelection.size > 0 ? nodesFromSelection : initialNodes
  );
  // エッジは後でuseEffectで計算される（フィルター適用のため）
  const [edges, setEdges] = useState<Map<string, ExplorerEdge>>(() => new Map());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const isInitializedRef = useRef(false);

  // Edge visibility state - initialize from URL params
  const [edgeVisibility, setEdgeVisibility] = useState<EdgeVisibility>(() => {
    if (typeof window === "undefined")
      return { accompaniment: true, cooccurrenceCompanion: true, similarByAccompaniment: false };
    const params = new URLSearchParams(window.location.search);
    const showAccompaniment = params.get("showAccompaniment") !== "false";
    const showCooccurrence = params.get("showCooccurrence") !== "false";
    const showSimilar = params.get("showSimilarByAccompaniment") === "true";
    return {
      accompaniment: showAccompaniment,
      cooccurrenceCompanion: showCooccurrence,
      similarByAccompaniment: showSimilar,
    };
  });
  const [minPmi, setMinPmi] = useState(() => {
    if (typeof window === "undefined") return 3;
    const params = new URLSearchParams(window.location.search);
    const pmi = params.get("minPmi");
    return pmi ? Number(pmi) : 3;
  });
  const [minCooccurrenceSourceCount, setMinCooccurrenceSourceCount] = useState(() => {
    if (typeof window === "undefined") return 2;
    const params = new URLSearchParams(window.location.search);
    const count = params.get("minCooccurrenceSourceCount");
    return count ? Number(count) : 2;
  });

  // 随伴関係モード用フィルター
  const [mutualOnly, setMutualOnly] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("mutualOnly") === "true";
  });
  const [minIdf, setMinIdf] = useState(() => {
    if (typeof window === "undefined") return 0;
    const params = new URLSearchParams(window.location.search);
    const idf = params.get("minIdf");
    return idf ? Number(idf) : 0;
  });

  // 随伴類似用フィルター
  const [minCommonAccompanimentCount, setMinCommonAccompanimentCount] = useState(() => {
    if (typeof window === "undefined") return 2;
    const params = new URLSearchParams(window.location.search);
    const count = params.get("minCommonAccompanimentCount");
    return count ? Number(count) : 2;
  });
  const [minRareScore, setMinRareScore] = useState(() => {
    if (typeof window === "undefined") return 0;
    const params = new URLSearchParams(window.location.search);
    const score = params.get("minRareScore");
    return score ? Number(score) : 3.5;
  });

  // Recalculate edges when visibility or filter changes
  useEffect(() => {
    if (nodesFromSelection.size === 0) {
      nodesRef.current = new Map();
      setNodes(new Map());
      setEdges(new Map());
      return;
    }

    // 両方のエッジを計算してマージ
    const allEdges = new Map<string, ExplorerEdge>();

    if (edgeVisibility.accompaniment) {
      const accompEdges = calculateEdgesForNodes(nodesFromSelection, accompaniments, {
        mutualOnly,
        minIdf,
        idfMap,
      });
      for (const [key, edge] of accompEdges) {
        allEdges.set(key, edge);
      }
    }

    if (edgeVisibility.cooccurrenceCompanion) {
      const coocEdges = calculateCooccurrenceEdgesForNodes(
        nodesFromSelection,
        cooccurrenceCompanionPairs,
        minPmi,
        minCooccurrenceSourceCount
      );
      for (const [key, edge] of coocEdges) {
        allEdges.set(key, edge);
      }
    }

    if (edgeVisibility.similarByAccompaniment) {
      const similarEdges = calculateSimilarByAccompanimentEdgesForNodes(
        nodesFromSelection,
        similarByAccompanimentPairs,
        minCommonAccompanimentCount,
        minRareScore
      );
      for (const [key, edge] of similarEdges) {
        allEdges.set(key, edge);
      }
    }

    // ボトムアップモード: 選択されたノードをそのまま表示
    if (mode === "bottomup") {
      nodesRef.current = nodesFromSelection;
      setNodes(nodesFromSelection);
      setEdges(allEdges);
      return;
    }

    // トップダウンモード: エッジに接続されているノードだけを表示
    const connectedNodeIds = new Set<string>();
    for (const edge of allEdges.values()) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }

    const filteredNodes = new Map<string, ExplorerNode>();
    for (const id of connectedNodeIds) {
      const node = nodesFromSelection.get(id);
      if (node) {
        filteredNodes.set(id, node);
      }
    }

    nodesRef.current = filteredNodes;
    setNodes(filteredNodes);
    setEdges(allEdges);
  }, [
    mode,
    edgeVisibility,
    minPmi,
    minCooccurrenceSourceCount,
    mutualOnly,
    minIdf,
    minCommonAccompanimentCount,
    minRareScore,
    nodesFromSelection,
    accompaniments,
    cooccurrenceCompanionPairs,
    similarByAccompanimentPairs,
    idfMap,
  ]);

  // Sync selection to URL query params
  useEffect(() => {
    // Skip the first render to avoid overwriting URL on SSR hydration
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      return;
    }

    const params = new URLSearchParams(window.location.search);

    // 古い形式のパラメータを削除
    params.delete("preset");
    params.delete("ids");
    params.delete("brands");

    // 新しい形式でパラメータを設定
    const selectionParams = getSelectionUrlParams(selectedIds, idolList);
    if (selectionParams.brands) {
      params.set("brands", selectionParams.brands);
    }
    if (selectionParams.ids) {
      params.set("ids", selectionParams.ids);
    }

    // Sync edge visibility and filter params
    params.delete("edgeMode"); // 古いパラメータを削除

    if (!edgeVisibility.accompaniment) {
      params.set("showAccompaniment", "false");
    } else {
      params.delete("showAccompaniment");
    }

    if (!edgeVisibility.cooccurrenceCompanion) {
      params.set("showCooccurrence", "false");
    } else {
      params.delete("showCooccurrence");
    }

    if (edgeVisibility.similarByAccompaniment) {
      params.set("showSimilarByAccompaniment", "true");
    } else {
      params.delete("showSimilarByAccompaniment");
    }

    // 随伴関係フィルターパラメータ
    if (mutualOnly) {
      params.set("mutualOnly", "true");
    } else {
      params.delete("mutualOnly");
    }
    if (minIdf > 0) {
      params.set("minIdf", String(minIdf));
    } else {
      params.delete("minIdf");
    }

    // 共起随伴ペアフィルターパラメータ
    if (minPmi !== 3) {
      params.set("minPmi", String(minPmi));
    } else {
      params.delete("minPmi");
    }
    if (minCooccurrenceSourceCount !== 2) {
      params.set("minCooccurrenceSourceCount", String(minCooccurrenceSourceCount));
    } else {
      params.delete("minCooccurrenceSourceCount");
    }

    // 随伴類似フィルターパラメータ
    if (minCommonAccompanimentCount !== 2) {
      params.set("minCommonAccompanimentCount", String(minCommonAccompanimentCount));
    } else {
      params.delete("minCommonAccompanimentCount");
    }
    if (minRareScore - 3.5 > 1e-4) {
      params.set("minRareScore", String(minRareScore));
    } else {
      params.delete("minRareScore");
    }

    // modeパラメータ
    if (mode === "bottomup") {
      params.set("mode", "bottomup");
    } else {
      params.delete("mode");
    }

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }, [
    selectedIds,
    idolList,
    edgeVisibility,
    minPmi,
    minCooccurrenceSourceCount,
    mutualOnly,
    minIdf,
    minCommonAccompanimentCount,
    minRareScore,
    mode,
  ]);

  // Ref to access current nodes without stale closure
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // 選択が変更されたらノードを更新
  const handleSelectionChange = useCallback((newSelectedIds: Set<string>) => {
    setSelectedIds(newSelectedIds);
    // nodesFromSelectionがuseMemoで自動更新され、useEffectでフィルタリングされる
  }, []);

  const nodesArray = useMemo(() => Array.from(nodes.values()), [nodes]);
  const edgesArray = useMemo(() => Array.from(edges.values()), [edges]);
  const displayedNodeIds = useMemo(() => new Set(nodes.keys()), [nodes]);
  // エッジに接続されているノードのIDセット（孤立ノード判定用）
  const connectedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const edge of edges.values()) {
      ids.add(edge.source);
      ids.add(edge.target);
    }
    return ids;
  }, [edges]);

  const addNode = useCallback(
    (idol: IdolListItem, options?: { keepSelection?: boolean }) => {
      // Already exists, optionally select it
      if (nodesRef.current.has(idol.id)) {
        if (!options?.keepSelection) {
          setSelectedNodeId(idol.id);
        }
        return;
      }

      const newNode: ExplorerNode = {
        id: idol.id,
        name: idol.name,
        brand: idol.brand,
      };

      // Immediately update nodesRef for subsequent calls in same event
      const updatedNodes = new Map(nodesRef.current);
      updatedNodes.set(idol.id, newNode);
      nodesRef.current = updatedNodes;

      // Calculate new edges against all existing nodes
      const newEdges = new Map<string, ExplorerEdge>();
      const idolAccompaniments = accompaniments[idol.id] ?? [];

      updatedNodes.forEach((existingNode) => {
        if (existingNode.id === idol.id) return; // Skip self

        const existingAccompaniments = accompaniments[existingNode.id] ?? [];

        const newToExisting = idolAccompaniments.includes(existingNode.id);
        const existingToNew = existingAccompaniments.includes(idol.id);

        if (newToExisting || existingToNew) {
          const edgeKey =
            idol.id < existingNode.id
              ? `accomp:${idol.id}|${existingNode.id}`
              : `accomp:${existingNode.id}|${idol.id}`;

          const isMutual = newToExisting && existingToNew;
          const source = newToExisting ? idol.id : existingNode.id;
          const target = newToExisting ? existingNode.id : idol.id;

          newEdges.set(edgeKey, {
            source,
            target,
            isMutual,
            weight: isMutual ? 1 : 0.5,
            edgeType: "accompaniment",
          });
        }
      });

      // Update state
      setNodes(updatedNodes);

      if (newEdges.size > 0) {
        setEdges((prev) => {
          const next = new Map(prev);
          newEdges.forEach((edge, key) => next.set(key, edge));
          return next;
        });
      }

      // Only change selection if not keeping current selection
      if (!options?.keepSelection) {
        setSelectedNodeId(idol.id);
      }

      setSelectedIds((prev) => new Set(prev).add(idol.id));
    },
    [accompaniments]
  );

  const addAccompanyingIdol = useCallback(
    (_fromId: string, toId: string) => {
      const toIdol = idols[toId];
      if (!toIdol) return;

      const idol: IdolListItem = {
        id: toId,
        name: toIdol.name,
        brand: toIdol.brand,
        kana: toIdol.kana,
      };
      if (toIdol.kana) {
        idol.kana = toIdol.kana;
      }

      // AccompanimentPanelからの追加時は選択を保持
      addNode(idol, { keepSelection: true });
    },
    [idols, addNode]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((prev) => {
        const next = new Map(prev);
        next.delete(nodeId);
        return next;
      });

      setEdges((prev) => {
        const next = new Map(prev);
        for (const key of prev.keys()) {
          if (key.includes(nodeId)) {
            next.delete(key);
          }
        }
        return next;
      });

      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [selectedNodeId]
  );

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const selectedNode = selectedNodeId ? nodes.get(selectedNodeId) : null;
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // コンテナサイズを監視
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const modeLabel = mode === "topdown" ? "トップダウン" : "ボトムアップ";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* ヘッダー */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: "#333",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <a
            href="/"
            style={{
              color: "#fff",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            ← 戻る
          </a>
          <span style={{ fontSize: "14px" }}>{modeLabel} グラフ探索</span>
          <ModeToggleLink currentMode={mode} onModeChange={setMode} />
        </div>
        <span style={{ fontSize: "11px", color: "#aaa" }}>
          ドラッグでノード移動 / ダブルクリックで固定 / ホイールでズーム
        </span>
      </header>

      {/* メインコンテンツ */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: "relative",
          background: "#fafafa",
          overflow: "hidden",
        }}
      >
        {/* フルスクリーングラフ */}
        {nodesArray.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            {nodesFromSelection.size > 0 ? (
              <EmptyMessage message="表示できるアイドルがいません" />
            ) : (
              <EmptyMessage message="アイドルを検索して追加してください" />
            )}
          </div>
        ) : (
          <GraphExplorerGraph
            nodes={nodesArray}
            edges={edgesArray}
            width={containerSize.width}
            height={containerSize.height}
            selectedNodeId={selectedNodeId}
            onBackgroundClick={handleBackgroundClick}
            onNodeClick={handleNodeClick}
            setNodes={setNodes}
          />
        )}

        {/* フローティングコントロールパネル（左上） */}
        <div
          style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            zIndex: 10,
            background: "rgba(255, 255, 255, 0.95)",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            padding: "8px",
            maxWidth: "320px",
          }}
        >
          {/* ノード選択 */}
          <NodeSelector
            idolList={idolList}
            selectedIds={selectedIds}
            onSelectionChange={handleSelectionChange}
            displayedNodeIds={displayedNodeIds}
            focusedNodeId={selectedNodeId}
            onFocusNode={handleNodeClick}
            connectedNodeIds={mode === "bottomup" ? connectedNodeIds : undefined}
          />

          <div style={{ marginTop: "12px", borderTop: "1px solid #eee", paddingTop: "12px" }}>
            <div style={{ fontSize: "11px", color: "#333", marginBottom: "8px" }}>
              表示するエッジ
            </div>

            {/* 随伴関係トグル */}
            <div style={{ marginBottom: "8px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  background: edgeVisibility.accompaniment ? "#e3f2fd" : "#f5f5f5",
                  border: edgeVisibility.accompaniment ? "1px solid #1976d2" : "1px solid #ddd",
                }}
              >
                <input
                  type="checkbox"
                  checked={edgeVisibility.accompaniment}
                  onChange={(e) =>
                    setEdgeVisibility((prev) => ({ ...prev, accompaniment: e.target.checked }))
                  }
                  style={{ margin: 0 }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    color: edgeVisibility.accompaniment ? "#1976d2" : "#666",
                    fontWeight: edgeVisibility.accompaniment ? "bold" : "normal",
                  }}
                >
                  随伴関係
                </span>
              </label>

              {edgeVisibility.accompaniment && (
                <div
                  style={{ marginTop: "6px", marginLeft: "24px", fontSize: "10px", color: "#666" }}
                >
                  <div style={{ marginBottom: "4px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <input
                        type="checkbox"
                        checked={mutualOnly}
                        onChange={(e) => setMutualOnly(e.target.checked)}
                      />
                      相互随伴のみ表示
                    </label>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "2px" }}>
                      最小IDF: {minIdf.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.1"
                      value={minIdf}
                      onChange={(e) => setMinIdf(Number(e.target.value))}
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 共起随伴ペアトグル */}
            <div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  background: edgeVisibility.cooccurrenceCompanion ? "#f3e5f5" : "#f5f5f5",
                  border: edgeVisibility.cooccurrenceCompanion
                    ? "1px solid #8e44ad"
                    : "1px solid #ddd",
                }}
              >
                <input
                  type="checkbox"
                  checked={edgeVisibility.cooccurrenceCompanion}
                  onChange={(e) =>
                    setEdgeVisibility((prev) => ({
                      ...prev,
                      cooccurrenceCompanion: e.target.checked,
                    }))
                  }
                  style={{ margin: 0 }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    color: edgeVisibility.cooccurrenceCompanion ? "#8e44ad" : "#666",
                    fontWeight: edgeVisibility.cooccurrenceCompanion ? "bold" : "normal",
                  }}
                >
                  共起随伴ペア
                </span>
              </label>

              {edgeVisibility.cooccurrenceCompanion && (
                <div
                  style={{ marginTop: "6px", marginLeft: "24px", fontSize: "10px", color: "#666" }}
                >
                  <div style={{ marginBottom: "4px" }}>
                    <label style={{ display: "block", marginBottom: "2px" }}>
                      最小PMI: {minPmi.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.1"
                      value={minPmi}
                      onChange={(e) => setMinPmi(Number(e.target.value))}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "2px" }}>
                      最小共起元数: {minCooccurrenceSourceCount}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={minCooccurrenceSourceCount}
                      onChange={(e) => setMinCooccurrenceSourceCount(Number(e.target.value))}
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 随伴類似トグル */}
            <div style={{ marginTop: "8px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  background: edgeVisibility.similarByAccompaniment ? "#e8f5e9" : "#f5f5f5",
                  border: edgeVisibility.similarByAccompaniment
                    ? "1px solid #2e7d32"
                    : "1px solid #ddd",
                }}
              >
                <input
                  type="checkbox"
                  checked={edgeVisibility.similarByAccompaniment}
                  onChange={(e) =>
                    setEdgeVisibility((prev) => ({
                      ...prev,
                      similarByAccompaniment: e.target.checked,
                    }))
                  }
                  style={{ margin: 0 }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    color: edgeVisibility.similarByAccompaniment ? "#2e7d32" : "#666",
                    fontWeight: edgeVisibility.similarByAccompaniment ? "bold" : "normal",
                  }}
                >
                  随伴類似
                </span>
              </label>

              {edgeVisibility.similarByAccompaniment && (
                <div
                  style={{ marginTop: "6px", marginLeft: "24px", fontSize: "10px", color: "#666" }}
                >
                  <div style={{ marginBottom: "4px" }}>
                    <label style={{ display: "block", marginBottom: "2px" }}>
                      最小共通随伴数: {minCommonAccompanimentCount}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="6"
                      step="1"
                      value={minCommonAccompanimentCount}
                      onChange={(e) => setMinCommonAccompanimentCount(Number(e.target.value))}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "2px" }}>
                      最小レアスコア: {minRareScore.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.1"
                      value={minRareScore}
                      onChange={(e) => setMinRareScore(Number(e.target.value))}
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* フローティング凡例（左下） */}
        {nodesArray.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: "16px",
              left: "16px",
              zIndex: 10,
              background: "rgba(255, 255, 255, 0.95)",
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
              padding: "12px",
              fontSize: "11px",
              color: "#666",
            }}
          >
            {/* 随伴関係の凡例 */}
            {edgeVisibility.accompaniment && (
              <>
                <div
                  style={{
                    marginBottom: "4px",
                    fontWeight: "bold",
                    fontSize: "10px",
                    color: "#1976d2",
                  }}
                >
                  随伴関係
                </div>
                <div style={{ marginBottom: "4px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "20px",
                      height: "2px",
                      background: "#1976d2",
                      verticalAlign: "middle",
                      marginRight: "6px",
                    }}
                  />
                  相互随伴
                </div>
                <div style={{ marginBottom: "6px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "20px",
                      height: "1px",
                      background: "#999",
                      verticalAlign: "middle",
                      marginRight: "6px",
                    }}
                  />
                  一方向
                </div>
              </>
            )}

            {/* 共起随伴ペアの凡例 */}
            {edgeVisibility.cooccurrenceCompanion && (
              <>
                <div
                  style={{
                    marginBottom: "4px",
                    fontWeight: "bold",
                    fontSize: "10px",
                    color: "#8e44ad",
                  }}
                >
                  共起随伴ペア
                </div>
                <div style={{ marginBottom: "4px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "20px",
                      height: "3px",
                      background: "#d4a017",
                      verticalAlign: "middle",
                      marginRight: "6px",
                    }}
                  />
                  高PMI (≥3.0)
                </div>
                <div style={{ marginBottom: "4px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "20px",
                      height: "2px",
                      background: "#8e44ad",
                      verticalAlign: "middle",
                      marginRight: "6px",
                    }}
                  />
                  通常
                </div>
                <div style={{ marginBottom: "6px", color: "#999", fontSize: "10px" }}>
                  太さ = 共起元数
                </div>
              </>
            )}

            {/* 随伴類似の凡例 */}
            {edgeVisibility.similarByAccompaniment && (
              <>
                <div
                  style={{
                    marginBottom: "4px",
                    fontWeight: "bold",
                    fontSize: "10px",
                    color: "#2e7d32",
                  }}
                >
                  随伴類似
                </div>
                <div style={{ marginBottom: "4px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "20px",
                      height: "2px",
                      background: "#2e7d32",
                      verticalAlign: "middle",
                      marginRight: "6px",
                    }}
                  />
                  共通随伴あり
                </div>
                <div style={{ marginBottom: "6px", color: "#999", fontSize: "10px" }}>
                  太さ = 共通随伴数
                </div>
              </>
            )}

            <div
              style={{
                marginBottom: "6px",
                borderTop:
                  edgeVisibility.accompaniment ||
                  edgeVisibility.cooccurrenceCompanion ||
                  edgeVisibility.similarByAccompaniment
                    ? "1px solid #eee"
                    : "none",
                paddingTop: "4px",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#4caf50",
                  verticalAlign: "middle",
                  marginRight: "6px",
                }}
              />
              固定
            </div>
            <div style={{ color: "#999", fontSize: "10px" }}>
              ノード: {nodesArray.length} / エッジ: {edgesArray.length}
            </div>
          </div>
        )}

        {/* フローティングパネルトグルボタン（右上）- ボトムアップモードのみ */}
        {mode === "bottomup" && (
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            style={{
              position: "absolute",
              top: "16px",
              right: isPanelOpen ? "336px" : "16px",
              zIndex: 11,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: "4px",
              padding: "8px 12px",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
              fontSize: "12px",
              transition: "right 0.2s ease",
            }}
          >
            {isPanelOpen ? "パネルを閉じる ▶" : "◀ パネルを開く"}
          </button>
        )}

        {/* フローティングAccompanimentPanel（右側）- ボトムアップモードのみ */}
        {mode === "bottomup" && (
          <div
            style={{
              position: "absolute",
              top: "16px",
              right: isPanelOpen ? "16px" : "-320px",
              bottom: "16px",
              width: "300px",
              zIndex: 10,
              transition: "right 0.2s ease",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                overflowY: "auto",
                background: "rgba(255, 255, 255, 0.98)",
                borderRadius: "8px",
                boxShadow: "0 2px 12px rgba(0, 0, 0, 0.15)",
              }}
            >
              {selectedNode ? (
                <AccompanimentPanel
                  selectedNode={selectedNode}
                  accompaniments={accompaniments}
                  idols={idols}
                  existingNodeIds={nodes}
                  onAddIdol={addAccompanyingIdol}
                  onDeleteNode={deleteNode}
                  onFocusNode={(id) => setSelectedNodeId(id)}
                  idfMap={idfMap}
                  pmiMap={pmiMap}
                  cooccurrenceCompanionPairs={cooccurrenceCompanionPairs}
                />
              ) : (
                <div
                  style={{
                    padding: "24px 16px",
                    textAlign: "center",
                    color: "#666",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {nodesArray.length > 0
                    ? "ノードをクリックして随伴アイドルを表示"
                    : "アイドルを検索してグラフにアイドルを追加してください"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

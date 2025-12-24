import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Brand } from "@/types";
import { EmptyMessage } from "../components/shared";
import IdolSearchBox from "./IdolSearchBox";
import GraphExplorerGraph from "./GraphExplorerGraph";
import AccompanimentPanel from "./AccompanimentPanel";
import type {
  IdolListItem,
  ExplorerNode,
  ExplorerEdge,
  EdgeMode,
  CooccurrenceCompanionPairData,
} from "./graphExplorerTypes";
export type { IdolListItem, ExplorerNode, ExplorerEdge } from "./graphExplorerTypes";

interface Props {
  idolList: IdolListItem[];
  accompaniments: Record<string, string[]>;
  idols: Record<string, { name: string; brand: Brand[]; kana: string }>;
  idfMap: Record<string, number>;
  pmiMap: Record<string, number>;
  cooccurrenceCompanionPairs: CooccurrenceCompanionPairData[];
}

const BRAND_LIST: Brand[] = ["imas", "deremas", "milimas", "sidem", "shiny", "gakuen"];

const BRAND_LABELS: Record<Brand, string> = {
  imas: "765PRO",
  deremas: "シンデレラ",
  milimas: "ミリオン",
  sidem: "SideM",
  shiny: "シャイニー",
  gakuen: "学マス",
};

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

        const edgeKey = idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
        const source = aToB ? idA : idB;
        const target = aToB ? idB : idA;

        edgeMap.set(edgeKey, {
          source,
          target,
          isMutual,
          weight: isMutual ? 1 : 0.5,
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
        ? `${pair.idolA.id}|${pair.idolB.id}`
        : `${pair.idolB.id}|${pair.idolA.id}`;

    edgeMap.set(edgeKey, {
      source: pair.idolA.id,
      target: pair.idolB.id,
      isMutual: true,
      weight: pair.cooccurrenceSourceCount / 10,
      pmi: pair.pmi,
      cooccurrenceSourceCount: pair.cooccurrenceSourceCount,
    });
  }

  return edgeMap;
}

export default function GraphExplorer({
  idolList,
  accompaniments,
  idols,
  idfMap,
  pmiMap,
  cooccurrenceCompanionPairs,
}: Props) {
  // 初期ノードを取得
  const initialNodes = useMemo(() => getInitialNodesFromUrl(idols), [idols]);

  const [nodes, setNodes] = useState<Map<string, ExplorerNode>>(() => initialNodes);
  // エッジは後でuseEffectで計算される（フィルター適用のため）
  const [edges, setEdges] = useState<Map<string, ExplorerEdge>>(() => new Map());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const isInitializedRef = useRef(false);

  // Edge mode state - initialize from URL params
  const [edgeMode, setEdgeMode] = useState<EdgeMode>(() => {
    if (typeof window === "undefined") return "accompaniment";
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("edgeMode");
    return mode === "cooccurrenceCompanion" ? "cooccurrenceCompanion" : "accompaniment";
  });
  const [minPmi, setMinPmi] = useState(() => {
    if (typeof window === "undefined") return 2;
    const params = new URLSearchParams(window.location.search);
    const pmi = params.get("minPmi");
    return pmi ? Number(pmi) : 2;
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

  // Isolateモード: エッジに繋がるノードだけを動的にフィルタリングする
  // 初期値はtrue（初期ノードがある場合）
  const [isIsolateMode, setIsIsolateMode] = useState(() => initialNodes.size > 0);
  const [baseNodes, setBaseNodes] = useState<Map<string, ExplorerNode> | null>(() =>
    initialNodes.size > 0 ? initialNodes : null
  );

  // Recalculate edges when mode or filter changes
  // Isolateモードの場合はbaseNodesからフィルタリング
  useEffect(() => {
    if (edgeMode === "accompaniment") {
      if (isIsolateMode && baseNodes) {
        // Isolateモード: baseNodesからエッジを計算し、接続されているノードだけを表示
        const filteredEdges = calculateEdgesForNodes(baseNodes, accompaniments, {
          mutualOnly,
          minIdf,
          idfMap,
        });

        const connectedNodeIds = new Set<string>();
        for (const edge of filteredEdges.values()) {
          connectedNodeIds.add(edge.source);
          connectedNodeIds.add(edge.target);
        }

        const filteredNodes = new Map<string, ExplorerNode>();
        for (const id of connectedNodeIds) {
          const node = baseNodes.get(id);
          if (node) {
            filteredNodes.set(id, node);
          }
        }

        nodesRef.current = filteredNodes;
        setNodes(filteredNodes);
        setEdges(filteredEdges);
      } else {
        // 通常モード: 現在のノードに対してエッジを計算
        setEdges(
          calculateEdgesForNodes(nodes, accompaniments, {
            mutualOnly,
            minIdf,
            idfMap,
          })
        );
      }
    } else {
      if (isIsolateMode && baseNodes) {
        // 共起随伴ペアモードのIsolate
        const filteredEdges = calculateCooccurrenceEdgesForNodes(
          baseNodes,
          cooccurrenceCompanionPairs,
          minPmi,
          minCooccurrenceSourceCount
        );

        const connectedNodeIds = new Set<string>();
        for (const edge of filteredEdges.values()) {
          connectedNodeIds.add(edge.source);
          connectedNodeIds.add(edge.target);
        }

        const filteredNodes = new Map<string, ExplorerNode>();
        for (const id of connectedNodeIds) {
          const node = baseNodes.get(id);
          if (node) {
            filteredNodes.set(id, node);
          }
        }

        nodesRef.current = filteredNodes;
        setNodes(filteredNodes);
        setEdges(filteredEdges);
      } else {
        setEdges(
          calculateCooccurrenceEdgesForNodes(
            nodes,
            cooccurrenceCompanionPairs,
            minPmi,
            minCooccurrenceSourceCount
          )
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    edgeMode,
    minPmi,
    minCooccurrenceSourceCount,
    mutualOnly,
    minIdf,
    // nodesは除外（isolateモード時に無限ループになるため）
    // 代わりにisIsolateModeとbaseNodesを監視
    isIsolateMode,
    baseNodes,
    accompaniments,
    cooccurrenceCompanionPairs,
    idfMap,
  ]);

  // 通常モード（非isolate）時のノード変更を監視
  useEffect(() => {
    if (!isIsolateMode) {
      if (edgeMode === "accompaniment") {
        setEdges(
          calculateEdgesForNodes(nodes, accompaniments, {
            mutualOnly,
            minIdf,
            idfMap,
          })
        );
      } else {
        setEdges(
          calculateCooccurrenceEdgesForNodes(
            nodes,
            cooccurrenceCompanionPairs,
            minPmi,
            minCooccurrenceSourceCount
          )
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, isIsolateMode]);

  // Sync nodes to URL query params
  useEffect(() => {
    // Skip the first render to avoid overwriting URL on SSR hydration
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      return;
    }

    const ids = Array.from(nodes.keys());
    const params = new URLSearchParams(window.location.search);
    const totalIdolCount = Object.keys(idols).length;

    // 全アイドルが表示されている場合は preset=all を使用
    if (ids.length === totalIdolCount && ids.length > 0) {
      params.delete("ids");
      params.set("preset", "all");
    } else if (ids.length > 0) {
      // ブランド別プリセットかチェック
      let matchedBrand: Brand | null = null;
      for (const brand of BRAND_LIST) {
        const brandIdols = getIdolsByBrand(idols, brand);
        if (brandIdols.size === ids.length) {
          const allMatch = ids.every((id) => brandIdols.has(id));
          if (allMatch) {
            matchedBrand = brand;
            break;
          }
        }
      }

      if (matchedBrand) {
        params.delete("ids");
        params.set("preset", matchedBrand);
      } else {
        params.delete("preset");
        params.set("ids", ids.join(","));
      }
    } else {
      params.delete("ids");
      params.delete("preset");
    }

    // Sync edge mode and filter params
    if (edgeMode === "cooccurrenceCompanion") {
      params.set("edgeMode", edgeMode);
      params.set("minPmi", String(minPmi));
      params.set("minCooccurrenceSourceCount", String(minCooccurrenceSourceCount));
      params.delete("mutualOnly");
      params.delete("minIdf");
    } else {
      params.delete("edgeMode");
      params.delete("minPmi");
      params.delete("minCooccurrenceSourceCount");
      // 随伴関係モードのフィルターパラメータ
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
    }

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }, [nodes, idols, edgeMode, minPmi, minCooccurrenceSourceCount, mutualOnly, minIdf]);

  // Ref to access current nodes without stale closure
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const nodesArray = useMemo(() => Array.from(nodes.values()), [nodes]);
  const edgesArray = useMemo(() => Array.from(edges.values()), [edges]);

  // Isolateモードを解除
  const disableIsolateMode = useCallback(() => {
    setIsIsolateMode(false);
    setBaseNodes(null);
  }, []);

  // Isolateモードを有効にして、エッジに繋がるノードだけを動的にフィルタリング
  const enableIsolateMode = useCallback(() => {
    // 現在のノードをbaseNodesとして保存
    setBaseNodes(new Map(nodes));
    setIsIsolateMode(true);
    setSelectedNodeId(null);
  }, [nodes]);

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
              ? `${idol.id}|${existingNode.id}`
              : `${existingNode.id}|${idol.id}`;

          const isMutual = newToExisting && existingToNew;
          const source = newToExisting ? idol.id : existingNode.id;
          const target = newToExisting ? existingNode.id : idol.id;

          newEdges.set(edgeKey, {
            source,
            target,
            isMutual,
            weight: isMutual ? 1 : 0.5,
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

  const addAllIdols = useCallback(() => {
    disableIsolateMode();
    const allNodes = new Map<string, ExplorerNode>();
    for (const [id, idol] of Object.entries(idols)) {
      allNodes.set(id, {
        id,
        name: idol.name,
        brand: idol.brand,
      });
    }
    nodesRef.current = allNodes;
    setNodes(allNodes);
    // エッジはuseEffectで再計算されるが、即座に反映するためにここでも計算
    if (edgeMode === "accompaniment") {
      setEdges(calculateEdgesForNodes(allNodes, accompaniments, { mutualOnly, minIdf, idfMap }));
    }
    setSelectedNodeId(null);
  }, [idols, accompaniments, edgeMode, mutualOnly, minIdf, idfMap, disableIsolateMode]);

  const addIdolsByBrand = useCallback(
    (brand: Brand) => {
      disableIsolateMode();
      const brandNodes = getIdolsByBrand(idols, brand);
      nodesRef.current = brandNodes;
      setNodes(brandNodes);
      // エッジはuseEffectで再計算されるが、即座に反映するためにここでも計算
      if (edgeMode === "accompaniment") {
        setEdges(
          calculateEdgesForNodes(brandNodes, accompaniments, { mutualOnly, minIdf, idfMap })
        );
      }
      setSelectedNodeId(null);
    },
    [idols, accompaniments, edgeMode, mutualOnly, minIdf, idfMap, disableIsolateMode]
  );

  const clearAllNodes = useCallback(() => {
    disableIsolateMode();
    nodesRef.current = new Map();
    setNodes(new Map());
    setEdges(new Map());
    setSelectedNodeId(null);
  }, [disableIsolateMode]);

  const setNodesFromCooccurrencePairs = useCallback(() => {
    enableIsolateMode();
  }, [enableIsolateMode]);

  // 現在のフィルター条件を満たすエッジに接続されているノードだけを残す
  const setNodesFromAccompanimentEdges = useCallback(() => {
    enableIsolateMode();
  }, [enableIsolateMode]);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const selectedNode = selectedNodeId ? nodes.get(selectedNodeId) : null;
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // タブ: "graph"（グラフ表示）または "edit"（ノード編集）
  const [activeTab, setActiveTab] = useState<"graph" | "edit">("graph");

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

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
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
          <EmptyMessage message="アイドルを検索して追加してください" />
        </div>
      ) : (
        <GraphExplorerGraph
          nodes={nodesArray}
          edges={edgesArray}
          width={containerSize.width}
          height={containerSize.height}
          selectedNodeId={selectedNodeId}
          onNodeClick={handleNodeClick}
          setNodes={setNodes}
          edgeMode={edgeMode}
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
        {/* タブバー */}
        <div
          style={{
            display: "flex",
            marginBottom: "8px",
            borderBottom: "2px solid #eee",
          }}
        >
          <button
            onClick={() => setActiveTab("graph")}
            style={{
              flex: 1,
              padding: "8px 12px",
              fontSize: "12px",
              fontWeight: activeTab === "graph" ? "bold" : "normal",
              background: "none",
              border: "none",
              borderBottom: activeTab === "graph" ? "2px solid #1976d2" : "2px solid transparent",
              marginBottom: "-2px",
              cursor: "pointer",
              color: activeTab === "graph" ? "#1976d2" : "#666",
            }}
          >
            グラフ
          </button>
          <button
            onClick={() => setActiveTab("edit")}
            style={{
              flex: 1,
              padding: "8px 12px",
              fontSize: "12px",
              fontWeight: activeTab === "edit" ? "bold" : "normal",
              background: "none",
              border: "none",
              borderBottom: activeTab === "edit" ? "2px solid #1976d2" : "2px solid transparent",
              marginBottom: "-2px",
              cursor: "pointer",
              color: activeTab === "edit" ? "#1976d2" : "#666",
            }}
          >
            ノード編集
          </button>
        </div>

        {/* ノード編集タブ */}
        {activeTab === "edit" && (
          <>
            <IdolSearchBox idolList={idolList} onSelect={addNode} existingNodeIds={nodes} />
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <select
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "all") {
                    addAllIdols();
                  } else if (value) {
                    addIdolsByBrand(value as Brand);
                  }
                  e.target.value = "";
                }}
                style={{
                  flex: 1,
                  padding: "6px 12px",
                  fontSize: "12px",
                  background: "#fff",
                  color: "#333",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  プリセットを適用...
                </option>
                <option value="all">全アイドル</option>
                {BRAND_LIST.map((brand) => (
                  <option key={brand} value={brand}>
                    {BRAND_LABELS[brand]}
                  </option>
                ))}
              </select>
              {nodesArray.length > 0 && (
                <button
                  onClick={clearAllNodes}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    background: "#f44336",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  全削除
                </button>
              )}
            </div>
            <div style={{ marginTop: "8px", fontSize: "11px", color: "#666" }}>
              現在 {nodesArray.length} ノード表示中
            </div>
          </>
        )}

        {/* グラフタブ */}
        {activeTab === "graph" && (
          <>
            {/* エッジモード切り替え（セグメントコントロール） */}
            <div
              style={{
                display: "flex",
                border: "1px solid #ccc",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setEdgeMode("accompaniment")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  fontSize: "11px",
                  background: edgeMode === "accompaniment" ? "#1976d2" : "#fff",
                  color: edgeMode === "accompaniment" ? "#fff" : "#666",
                  border: "none",
                  borderRight: "1px solid #ccc",
                  cursor: "pointer",
                  fontWeight: edgeMode === "accompaniment" ? "bold" : "normal",
                }}
              >
                随伴関係
              </button>
              <button
                onClick={() => setEdgeMode("cooccurrenceCompanion")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  fontSize: "11px",
                  background: edgeMode === "cooccurrenceCompanion" ? "#8e44ad" : "#fff",
                  color: edgeMode === "cooccurrenceCompanion" ? "#fff" : "#666",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: edgeMode === "cooccurrenceCompanion" ? "bold" : "normal",
                }}
              >
                共起随伴ペア
              </button>
            </div>

            {/* Isolateモード表示・切り替え */}
            <div
              style={{
                marginTop: "8px",
                padding: "6px 8px",
                background: isIsolateMode ? "#e3f2fd" : "#f5f5f5",
                borderRadius: "4px",
                fontSize: "11px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ color: isIsolateMode ? "#1976d2" : "#666" }}>
                  {isIsolateMode ? "🔒 全体から再計算" : "📝 現在のノードを編集"}
                </span>
                {isIsolateMode && (
                  <button
                    onClick={disableIsolateMode}
                    style={{
                      padding: "2px 6px",
                      fontSize: "10px",
                      background: "#fff",
                      color: "#666",
                      border: "1px solid #ccc",
                      borderRadius: "3px",
                      cursor: "pointer",
                    }}
                  >
                    解除
                  </button>
                )}
              </div>
              {isIsolateMode && baseNodes && (
                <div style={{ marginTop: "4px", color: "#999", fontSize: "10px" }}>
                  ベース: {baseNodes.size}ノード
                </div>
              )}
            </div>

            {/* 共起随伴ペアモード時のフィルタ */}
            {edgeMode === "cooccurrenceCompanion" && (
              <div style={{ marginTop: "8px", fontSize: "11px", color: "#666" }}>
                <div style={{ marginBottom: "4px" }}>
                  <label style={{ display: "block", marginBottom: "2px" }}>
                    最小PMI: {minPmi.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={minPmi}
                    onChange={(e) => setMinPmi(Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                </div>
                <div style={{ marginBottom: "8px" }}>
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
                <button
                  onClick={setNodesFromCooccurrencePairs}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    fontSize: "11px",
                    background: "#8e44ad",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  エッジに繋がるノードだけにする
                </button>
              </div>
            )}

            {/* 随伴関係モード時のフィルタ */}
            {edgeMode === "accompaniment" && (
              <div style={{ marginTop: "8px", fontSize: "11px", color: "#666" }}>
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
                <div style={{ marginBottom: "8px" }}>
                  <label style={{ display: "block", marginBottom: "2px" }}>
                    最小IDF: {minIdf.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={minIdf}
                    onChange={(e) => setMinIdf(Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                </div>
                <button
                  onClick={setNodesFromAccompanimentEdges}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    fontSize: "11px",
                    background: "#1976d2",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  エッジに繋がるノードだけにする
                </button>
              </div>
            )}
          </>
        )}
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
          {edgeMode === "accompaniment" ? (
            <>
              <div style={{ marginBottom: "6px" }}>
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
          ) : (
            <>
              <div style={{ marginBottom: "6px" }}>
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
              <div style={{ marginBottom: "6px" }}>
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
          <div style={{ marginBottom: "6px" }}>
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

      {/* フローティングパネルトグルボタン（右上） */}
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

      {/* フローティングAccompanimentPanel（右側） */}
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
              idfMap={idfMap}
              pmiMap={pmiMap}
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
    </div>
  );
}

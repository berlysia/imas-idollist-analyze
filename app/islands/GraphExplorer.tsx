import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Brand } from "@/types";
import { EmptyMessage } from "../components/shared";
import IdolSearchBox from "./IdolSearchBox";
import GraphExplorerGraph from "./GraphExplorerGraph";
import AccompanimentPanel from "./AccompanimentPanel";
import type { IdolListItem, ExplorerNode, ExplorerEdge } from "./graphExplorerTypes";
export type { IdolListItem, ExplorerNode, ExplorerEdge } from "./graphExplorerTypes";

interface Props {
  idolList: IdolListItem[];
  accompaniments: Record<string, string[]>;
  idols: Record<string, { name: string; brand: Brand[]; kana: string }>;
  idfMap: Record<string, number>;
  pmiMap: Record<string, number>;
}

function getInitialNodesFromUrl(
  idols: Record<string, { name: string; brand: Brand[]; kana: string }>
): Map<string, ExplorerNode> {
  if (typeof window === "undefined") return new Map();

  const params = new URLSearchParams(window.location.search);
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
  accompaniments: Record<string, string[]>
): Map<string, ExplorerEdge> {
  const edgeMap = new Map<string, ExplorerEdge>();
  const nodeIds = Array.from(nodes.keys());

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
        const edgeKey = idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
        const isMutual = aToB && bToA;
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

export default function GraphExplorer({ idolList, accompaniments, idols, idfMap, pmiMap }: Props) {
  const [nodes, setNodes] = useState<Map<string, ExplorerNode>>(() =>
    getInitialNodesFromUrl(idols)
  );
  const [edges, setEdges] = useState<Map<string, ExplorerEdge>>(() =>
    calculateEdgesForNodes(getInitialNodesFromUrl(idols), accompaniments)
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const isInitializedRef = useRef(false);

  // Sync nodes to URL query params
  useEffect(() => {
    // Skip the first render to avoid overwriting URL on SSR hydration
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      return;
    }

    const ids = Array.from(nodes.keys());
    const params = new URLSearchParams(window.location.search);

    if (ids.length > 0) {
      params.set("ids", ids.join(","));
    } else {
      params.delete("ids");
    }

    const newUrl = ids.length > 0 ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }, [nodes]);

  // Ref to access current nodes without stale closure
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const nodesArray = useMemo(() => Array.from(nodes.values()), [nodes]);
  const edgesArray = useMemo(() => Array.from(edges.values()), [edges]);

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

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
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
        />
      )}

      {/* フローティング検索ボックス（左上） */}
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
        <IdolSearchBox idolList={idolList} onSelect={addNode} existingNodeIds={nodes} />
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
          <div style={{ color: "#999", fontSize: "10px" }}>ノード: {nodesArray.length}</div>
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

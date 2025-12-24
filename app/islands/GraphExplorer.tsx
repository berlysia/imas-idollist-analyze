import { useState, useCallback, useMemo, useRef } from "react";
import type { Brand } from "@/types";
import { GraphSection, EmptyMessage } from "../components/shared";
import IdolSearchBox from "./IdolSearchBox";
import GraphExplorerGraph from "./GraphExplorerGraph";
import AccompanimentPanel from "./AccompanimentPanel";
import type { IdolListItem, ExplorerNode, ExplorerEdge } from "./graphExplorerTypes";
export type { IdolListItem, ExplorerNode, ExplorerEdge } from "./graphExplorerTypes";

interface Props {
  idolList: IdolListItem[];
  accompaniments: Record<string, string[]>;
  idols: Record<string, { name: string; brand: Brand[]; kana?: string }>;
}

export default function GraphExplorer({ idolList, accompaniments, idols }: Props) {
  const [nodes, setNodes] = useState<Map<string, ExplorerNode>>(new Map());
  const [edges, setEdges] = useState<Map<string, ExplorerEdge>>(new Map());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Ref to access current nodes without stale closure
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const nodesArray = useMemo(() => Array.from(nodes.values()), [nodes]);
  const edgesArray = useMemo(() => Array.from(edges.values()), [edges]);

  const addNode = useCallback(
    (idol: IdolListItem) => {
      const currentNodes = nodesRef.current;

      // Already exists, just select it
      if (currentNodes.has(idol.id)) {
        setSelectedNodeId(idol.id);
        return;
      }

      const newNode: ExplorerNode = {
        id: idol.id,
        name: idol.name,
        brand: idol.brand,
      };

      // Calculate new edges
      const newEdges = new Map<string, ExplorerEdge>();
      const idolAccompaniments = accompaniments[idol.id] ?? [];

      currentNodes.forEach((existingNode) => {
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

      // Batch state updates
      setNodes((prev) => {
        const next = new Map(prev);
        next.set(idol.id, newNode);
        return next;
      });

      if (newEdges.size > 0) {
        setEdges((prev) => {
          const next = new Map(prev);
          newEdges.forEach((edge, key) => next.set(key, edge));
          return next;
        });
      }

      setSelectedNodeId(idol.id);
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
      };
      if (toIdol.kana) {
        idol.kana = toIdol.kana;
      }

      addNode(idol);
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

  return (
    <div>
      <div style={{ marginBottom: "16px" }}>
        <IdolSearchBox idolList={idolList} onSelect={addNode} existingNodeIds={nodes} />
      </div>

      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 600px", minWidth: "300px" }}>
          <GraphSection>
            {(width) =>
              nodesArray.length === 0 ? (
                <EmptyMessage message="アイドルを検索して追加してください" />
              ) : (
                <GraphExplorerGraph
                  nodes={nodesArray}
                  edges={edgesArray}
                  width={width}
                  height={500}
                  selectedNodeId={selectedNodeId}
                  onNodeClick={handleNodeClick}
                  setNodes={setNodes}
                />
              )
            }
          </GraphSection>

          {nodesArray.length > 0 && (
            <div
              style={{
                fontSize: "12px",
                color: "#666",
                marginTop: "8px",
                padding: "8px",
                background: "#f9f9f9",
                borderRadius: "4px",
              }}
            >
              <span style={{ marginRight: "16px" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "20px",
                    height: "2px",
                    background: "#1976d2",
                    verticalAlign: "middle",
                    marginRight: "4px",
                  }}
                />
                相互随伴
              </span>
              <span style={{ marginRight: "16px" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "20px",
                    height: "1px",
                    background: "#999",
                    verticalAlign: "middle",
                    marginRight: "4px",
                  }}
                />
                一方向
              </span>
              <span>ノード数: {nodesArray.length}</span>
            </div>
          )}
        </div>

        <div style={{ flex: "0 0 300px", minWidth: "280px" }}>
          {selectedNode ? (
            <AccompanimentPanel
              selectedNode={selectedNode}
              accompaniments={accompaniments}
              idols={idols}
              existingNodeIds={nodes}
              onAddIdol={addAccompanyingIdol}
              onDeleteNode={deleteNode}
            />
          ) : (
            <div
              style={{
                padding: "16px",
                background: "#f9f9f9",
                borderRadius: "8px",
                textAlign: "center",
                color: "#666",
              }}
            >
              {nodesArray.length > 0
                ? "ノードをクリックして随伴アイドルを表示"
                : "アイドルを検索して追加してください"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

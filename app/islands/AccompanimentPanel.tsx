import { useMemo } from "react";
import type { Brand } from "@/types";
import { BrandDot } from "../components/shared";
import { BRAND_NAMES } from "../lib/constants";
import type { ExplorerNode } from "./graphExplorerTypes";

interface Props {
  selectedNode: ExplorerNode;
  accompaniments: Record<string, string[]>;
  idols: Record<string, { name: string; brand: Brand[]; kana?: string }>;
  existingNodeIds: Map<string, ExplorerNode>;
  onAddIdol: (fromId: string, toId: string) => void;
  onDeleteNode: (nodeId: string) => void;
}

export default function AccompanimentPanel({
  selectedNode,
  accompaniments,
  idols,
  existingNodeIds,
  onAddIdol,
  onDeleteNode,
}: Props) {
  // Build accompaniment list from props
  const accompanimentList = useMemo(() => {
    const accompIds = accompaniments[selectedNode.id] ?? [];
    const list = accompIds.map((id) => {
      const idol = idols[id];
      // Check if this idol also has selectedNode in their accompaniments (mutual)
      const theirAccompaniments = accompaniments[id] ?? [];
      const isMutual = theirAccompaniments.includes(selectedNode.id);
      return {
        id,
        name: idol?.name ?? id,
        brand: idol?.brand ?? [],
        isMutual,
      };
    });
    // Sort: mutual first, then by name
    list.sort((a, b) => {
      if (a.isMutual !== b.isMutual) return a.isMutual ? -1 : 1;
      return a.name.localeCompare(b.name, "ja");
    });
    return list;
  }, [selectedNode.id, accompaniments, idols]);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          background: "#f5f5f5",
          borderBottom: "1px solid #ddd",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          {selectedNode.brand.map((b) => (
            <BrandDot key={b} brand={b} size="large" />
          ))}
          <span style={{ fontWeight: "bold", fontSize: "16px" }}>{selectedNode.name}</span>
        </div>
        <div style={{ fontSize: "12px", color: "#666" }}>
          {selectedNode.brand.map((b) => BRAND_NAMES[b]).join(" / ")}
        </div>
      </div>

      {/* Accompaniments List */}
      <div style={{ padding: "12px 16px" }}>
        <div style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "8px" }}>
          随伴アイドル ({accompanimentList.length})
        </div>

        <div
          style={{
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          {accompanimentList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px", color: "#999" }}>
              随伴アイドルがいません
            </div>
          ) : (
            accompanimentList.map((idol) => {
              const isExisting = existingNodeIds.has(idol.id);
              return (
                <div
                  key={idol.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px",
                    borderBottom: "1px solid #eee",
                    background: isExisting ? "#f9f9f9" : "#fff",
                  }}
                >
                  <span style={{ display: "flex", gap: "2px" }}>
                    {idol.brand.map((b) => (
                      <BrandDot key={b} brand={b} size="small" />
                    ))}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: idol.isMutual ? "bold" : "normal",
                        color: idol.isMutual ? "#1976d2" : "#333",
                      }}
                    >
                      {idol.name}
                      {idol.isMutual && (
                        <span
                          style={{
                            fontSize: "10px",
                            marginLeft: "4px",
                            color: "#1976d2",
                          }}
                        >
                          ↔
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onAddIdol(selectedNode.id, idol.id)}
                    disabled={isExisting}
                    style={{
                      padding: "4px 8px",
                      fontSize: "11px",
                      background: isExisting ? "#e0e0e0" : "#1976d2",
                      color: isExisting ? "#999" : "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: isExisting ? "default" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isExisting ? "追加済" : "+追加"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete Button */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #ddd",
          background: "#f9f9f9",
        }}
      >
        <button
          onClick={() => onDeleteNode(selectedNode.id)}
          style={{
            width: "100%",
            padding: "8px",
            background: "#fff",
            color: "#d32f2f",
            border: "1px solid #d32f2f",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          このノードを削除
        </button>
      </div>
    </div>
  );
}

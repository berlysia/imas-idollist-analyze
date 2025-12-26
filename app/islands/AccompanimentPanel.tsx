import { useMemo, useState } from "react";
import type { Brand } from "../types";
import { BrandDot, ScoreBadge } from "../components/shared";
import { BRAND_NAMES } from "../lib/constants";
import type { ExplorerNode, CooccurrenceCompanionPairData } from "./graphExplorerTypes";
import { computeSimilarIdolGroups } from "../lib/compute";

interface Props {
  selectedNode: ExplorerNode;
  accompaniments: Record<string, string[]>;
  idols: Record<string, { name: string; brand: Brand[]; kana: string }>;
  existingNodeIds: Map<string, ExplorerNode>;
  onAddIdol: (fromId: string, toId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onFocusNode: (nodeId: string) => void;
  idfMap: Record<string, number>;
  pmiMap: Record<string, number>;
  cooccurrenceCompanionPairs?: CooccurrenceCompanionPairData[];
}

export default function AccompanimentPanel({
  selectedNode,
  accompaniments,
  idols,
  existingNodeIds,
  onAddIdol,
  onDeleteNode,
  onFocusNode,
  idfMap,
  pmiMap,
  cooccurrenceCompanionPairs,
}: Props) {
  const [expandedSimilarIdol, setExpandedSimilarIdol] = useState<string | null>(null);

  // Build accompaniment list from props
  const accompanimentList = useMemo(() => {
    const accompIds = accompaniments[selectedNode.id] ?? [];
    const list = accompIds.map((id) => {
      const idol = idols[id];
      // Check if this idol also has selectedNode in their accompaniments (mutual)
      const theirAccompaniments = accompaniments[id] ?? [];
      const isMutual = theirAccompaniments.includes(selectedNode.id);

      // IDF: このアイドルを選ぶことの珍しさ（高いほど珍しい）
      const idf = idfMap[id] ?? 0;

      // PMI: 相互随伴の場合のペアの意外性
      let pmi: number | undefined;
      if (isMutual) {
        const pmiKey =
          selectedNode.id < id ? `${selectedNode.id}|${id}` : `${id}|${selectedNode.id}`;
        pmi = pmiMap[pmiKey];
      }

      return {
        id,
        name: idol?.name ?? id,
        brand: idol?.brand ?? [],
        isMutual,
        idf,
        pmi,
      };
    });
    // Sort: mutual first, then by IDF (descending)
    list.sort((a, b) => {
      if (a.isMutual !== b.isMutual) return a.isMutual ? -1 : 1;
      return b.idf - a.idf;
    });
    return list;
  }, [selectedNode.id, accompaniments, idols, idfMap, pmiMap]);

  // 選択中のアイドルを随伴しているアイドルのリスト
  const incomingAccompaniments = useMemo(() => {
    const list = Object.entries(accompaniments).flatMap(([idolId, accompIds]) => {
      if (accompIds.includes(selectedNode.id)) {
        return [
          {
            id: idolId,
            name: idols[idolId]?.name,
            brand: idols[idolId]?.brand ?? [],
            isMutual: accompaniments[selectedNode.id]?.includes(idolId) ?? false,
            idf: idfMap[idolId] ?? 0,
          },
        ];
      }
      return [];
    });
    return list;
  }, [selectedNode.id, accompaniments]);

  // Compute similar idols (same accompaniment choices)
  const similarIdolGroups = useMemo(() => {
    // Build NormalizedData from props
    const normalizedData = {
      scrapedAt: "",
      idols: Object.fromEntries(
        Object.entries(idols).map(([id, idol]) => [
          id,
          { ...idol, link: "" }, // link is required by NormalizedData but not used
        ])
      ),
      accompaniments,
    };

    // Convert idfMap Record to Map
    const idfMapAsMap = new Map(Object.entries(idfMap));

    return computeSimilarIdolGroups(normalizedData, selectedNode.id, idfMapAsMap, 5);
  }, [selectedNode.id, idols, accompaniments, idfMap]);

  // 選択アイドルとペアを形成している相手アイドル一覧
  const cooccurrencePartners = useMemo(() => {
    if (!cooccurrenceCompanionPairs) {
      return [];
    }

    return cooccurrenceCompanionPairs
      .filter((pair) => pair.idolA.id === selectedNode.id || pair.idolB.id === selectedNode.id)
      .map((pair) => ({
        partner: pair.idolA.id === selectedNode.id ? pair.idolB : pair.idolA,
        pmi: pair.pmi,
        cooccurrenceSourceCount: pair.cooccurrenceSourceCount,
        cooccurrenceSources: pair.cooccurrenceSources,
      }))
      .sort((a, b) => b.pmi - a.pmi);
  }, [selectedNode.id, cooccurrenceCompanionPairs]);

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
          <a href={`/idol/${selectedNode.id}`} target="_blank" rel="noreferrer">
            🔗
          </a>
        </div>
        <div style={{ fontSize: "12px", color: "#666" }}>
          {selectedNode.brand.map((b) => BRAND_NAMES[b]).join(" / ")}
        </div>
      </div>

      {/* Accompaniments & Similar Idols List */}
      <div style={{ padding: "12px 16px" }}>
        <div
          style={{
            maxHeight: "400px",
            overflowY: "auto",
          }}
        >
          {/* Accompaniments Section */}
          <div
            style={{
              fontWeight: "bold",
              fontSize: "13px",
              padding: "4px 0",
              marginBottom: "4px",
              color: "#555",
            }}
          >
            随伴アイドル ({accompanimentList.length})
          </div>

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
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#888",
                        marginTop: "2px",
                      }}
                    >
                      <ScoreBadge metric="idf" value={idol.idf} />
                      {idol.pmi !== undefined && <ScoreBadge metric="pmi" value={idol.pmi} />}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      isExisting ? onFocusNode(idol.id) : onAddIdol(selectedNode.id, idol.id)
                    }
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

          <div
            style={{
              fontWeight: "bold",
              fontSize: "13px",
              padding: "4px 0",
              marginBottom: "4px",
              color: "#555",
            }}
          >
            被随伴アイドル ({incomingAccompaniments.length})
          </div>

          {incomingAccompaniments.length > 0 &&
            incomingAccompaniments.map((idol) => {
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
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#888",
                        marginTop: "2px",
                      }}
                    >
                      <ScoreBadge metric="idf" value={idol.idf} />
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      isExisting ? onFocusNode(idol.id) : onAddIdol(selectedNode.id, idol.id)
                    }
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
            })}

          {/* Similar Idols Section - 随伴による類似 */}
          {similarIdolGroups.length > 0 && (
            <>
              <div
                style={{
                  fontWeight: "bold",
                  fontSize: "13px",
                  padding: "4px 0",
                  marginTop: "12px",
                  marginBottom: "4px",
                  color: "#555",
                  borderTop: "1px solid #ddd",
                  paddingTop: "12px",
                }}
              >
                類似アイドル（随伴による） (
                {similarIdolGroups.reduce((sum, g) => sum + g.idols.length, 0)})
              </div>
              <div style={{ fontSize: "10px", color: "#888", marginBottom: "8px" }}>
                同じ随伴を選んでいる
              </div>

              {similarIdolGroups.map((group, groupIndex) =>
                group.idols.map((idol) => {
                  const isExisting = existingNodeIds.has(idol.id);
                  const isExpanded = expandedSimilarIdol === idol.id;
                  const similarAccompaniments = accompaniments[idol.id] ?? [];
                  const similarIdolIdf = idfMap[idol.id] ?? 0;

                  return (
                    <div
                      key={`${groupIndex}-${idol.id}`}
                      style={{
                        marginBottom: "4px",
                        background: "#fafafa",
                        borderRadius: "4px",
                        border: "1px solid #eee",
                        overflow: "hidden",
                      }}
                    >
                      {/* Similar idol header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "8px",
                          cursor: "pointer",
                          background: isExpanded ? "#e8f5e9" : "#fafafa",
                        }}
                        onClick={() => setExpandedSimilarIdol(isExpanded ? null : idol.id)}
                      >
                        <span style={{ fontSize: "10px", color: "#666" }}>
                          {isExpanded ? "▼" : "▶"}
                        </span>
                        <span style={{ display: "flex", gap: "2px" }}>
                          {idol.brand.map((b) => (
                            <BrandDot key={b} brand={b} size="small" />
                          ))}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "12px" }}>
                            {idol.name}
                            <ScoreBadge metric="idf" value={similarIdolIdf} />
                          </div>
                          <div style={{ fontSize: "9px", color: "#888" }}>
                            共通: {group.commonAccompaniments.map((a) => a.name).join(", ")}
                            <ScoreBadge metric="idf-geometric-mean" value={similarIdolIdf} />
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();

                            if (isExisting) {
                              onFocusNode(idol.id);
                              return;
                            }

                            // 類似アイドル自身を追加
                            onAddIdol(selectedNode.id, idol.id);
                            // 共通随伴も自動追加
                            for (const common of group.commonAccompaniments) {
                              if (!existingNodeIds.has(common.id)) {
                                onAddIdol(selectedNode.id, common.id);
                              }
                            }
                          }}
                          style={{
                            padding: "2px 6px",
                            fontSize: "10px",
                            background: isExisting ? "#e0e0e0" : "#8e44ad",
                            color: isExisting ? "#999" : "#fff",
                            border: "none",
                            borderRadius: "3px",
                            cursor: isExisting ? "default" : "pointer",
                          }}
                        >
                          {isExisting ? "追加済" : "+追加"}
                        </button>
                      </div>

                      {/* Expanded: show this similar idol's accompaniments */}
                      {isExpanded && (
                        <div
                          style={{
                            padding: "8px",
                            paddingTop: "4px",
                            borderTop: "1px solid #ddd",
                            background: "#fff",
                          }}
                        >
                          <div style={{ fontSize: "10px", color: "#666", marginBottom: "4px" }}>
                            {idol.name}の随伴 ({similarAccompaniments.length}):
                          </div>
                          {similarAccompaniments.map((accompId) => {
                            const accompIdol = idols[accompId];
                            const accompIsExisting = existingNodeIds.has(accompId);
                            const accompIdf = idfMap[accompId] ?? 0;
                            return (
                              <div
                                key={accompId}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "4px 0",
                                  fontSize: "11px",
                                }}
                              >
                                <span style={{ display: "flex", gap: "2px" }}>
                                  {(accompIdol?.brand ?? []).map((b) => (
                                    <BrandDot key={b} brand={b} size="small" />
                                  ))}
                                </span>
                                <span style={{ flex: 1 }}>{accompIdol?.name ?? accompId}</span>
                                <ScoreBadge metric="idf" value={accompIdf} />
                                <button
                                  onClick={() =>
                                    accompIsExisting
                                      ? onFocusNode(accompId)
                                      : onAddIdol(idol.id, accompId)
                                  }
                                  disabled={accompIsExisting}
                                  style={{
                                    padding: "2px 4px",
                                    fontSize: "9px",
                                    background: accompIsExisting ? "#e0e0e0" : "#1976d2",
                                    color: accompIsExisting ? "#999" : "#fff",
                                    border: "none",
                                    borderRadius: "3px",
                                    cursor: accompIsExisting ? "default" : "pointer",
                                  }}
                                >
                                  {accompIsExisting ? "済" : "+"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* Cooccurrence Companion Pairs Section */}
          <div
            style={{
              fontWeight: "bold",
              fontSize: "13px",
              padding: "4px 0",
              marginBottom: "4px",
              color: "#8e44ad",
            }}
          >
            共起随伴ペア ({cooccurrencePartners.length})
          </div>

          {cooccurrencePartners.length > 0 &&
            cooccurrencePartners.map((item) => {
              const isExisting = existingNodeIds.has(item.partner.id);
              const isHighPmi = item.pmi >= 3.0;

              return (
                <details
                  key={item.partner.id}
                  style={{
                    marginBottom: "4px",
                    border: isHighPmi ? "2px solid #d4a017" : "1px solid #e0e0e0",
                    borderRadius: "4px",
                    background: isHighPmi ? "#fffbeb" : "#fafafa",
                    boxShadow: isHighPmi ? "0 2px 8px rgba(212, 160, 23, 0.2)" : undefined,
                  }}
                >
                  <summary
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px",
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                  >
                    {isHighPmi && (
                      <span style={{ color: "#d4a017", fontSize: "14px" }} title="高PMIペア">
                        ★
                      </span>
                    )}
                    <span style={{ display: "flex", gap: "2px" }}>
                      {item.partner.brand.map((b) => (
                        <BrandDot key={b} brand={b} size="small" />
                      ))}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: isHighPmi ? "bold" : "normal" }}>
                        {item.partner.name}
                      </div>
                      <div style={{ fontSize: "10px", color: "#888", marginTop: "2px" }}>
                        <ScoreBadge metric="pmi" value={item.pmi} />
                        <span style={{ marginLeft: "6px" }}>
                          共起元: {item.cooccurrenceSourceCount}人
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isExisting) {
                          onFocusNode(item.partner.id);
                          return;
                        }
                        onAddIdol(selectedNode.id, item.partner.id);
                      }}
                      disabled={isExisting}
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        background: isExisting ? "#e0e0e0" : "#8e44ad",
                        color: isExisting ? "#999" : "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: isExisting ? "default" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isExisting ? "追加済" : "+追加"}
                    </button>
                  </summary>

                  <div
                    style={{
                      padding: "8px 12px 12px 28px",
                      borderTop: "1px solid #e0e0e0",
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>
                      共起元（このペアを同時に随伴しているアイドル）:
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {item.cooccurrenceSources.map((source) => {
                        const sourceIsExisting = existingNodeIds.has(source.id);
                        return (
                          <div
                            key={source.id}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 8px",
                              background: sourceIsExisting ? "#e8f5e9" : "#f5f5f5",
                              border: "1px solid #ddd",
                              borderRadius: "4px",
                              fontSize: "12px",
                            }}
                          >
                            {source.brand.map((b) => (
                              <BrandDot key={b} brand={b} size="small" />
                            ))}
                            <span>{source.name}</span>
                            <button
                              onClick={() => onAddIdol(selectedNode.id, source.id)}
                              disabled={sourceIsExisting}
                              style={{
                                padding: "2px 4px",
                                fontSize: "9px",
                                background: sourceIsExisting ? "#e0e0e0" : "#1976d2",
                                color: sourceIsExisting ? "#999" : "#fff",
                                border: "none",
                                borderRadius: "3px",
                                cursor: sourceIsExisting ? "default" : "pointer",
                                marginLeft: "4px",
                              }}
                            >
                              {sourceIsExisting ? "済" : "+"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </details>
              );
            })}
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

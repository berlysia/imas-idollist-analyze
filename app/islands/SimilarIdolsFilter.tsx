import { useState, useMemo } from "react";
import type { Brand } from "@/types";
import { BrandDot } from "../components/shared";

interface CommonAccompaniment {
  id: string;
  name: string;
  brand: Brand[];
  idf: number;
}

interface SimilarIdolGroup {
  commonAccompanimentCount: number;
  avgIdf: number;
  commonAccompaniments: CommonAccompaniment[];
  idols: Array<{ id: string; name: string; brand: Brand[] }>;
}

interface SelectedIdol {
  id: string;
  name: string;
  brand: Brand[];
  score: {
    idf: number;
  };
}

interface Props {
  groups: SimilarIdolGroup[];
  selectedIdols: SelectedIdol[];
}

export default function SimilarIdolsFilter({ groups, selectedIdols }: Props) {
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());

  const toggleFilter = (idolId: string) => {
    setSelectedFilters((prev) => {
      const next = new Set(prev);
      if (next.has(idolId)) {
        next.delete(idolId);
      } else {
        next.add(idolId);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSelectedFilters(new Set());
  };

  const filteredGroups = useMemo(() => {
    if (selectedFilters.size === 0) {
      return groups;
    }
    return groups.filter((group) => {
      const groupAccompIds = new Set(group.commonAccompaniments.map((a) => a.id));
      // 選択されたフィルターがすべて含まれているグループのみ表示
      return Array.from(selectedFilters).every((filterId) => groupAccompIds.has(filterId));
    });
  }, [groups, selectedFilters]);

  // 選択中のフィルターの累乗平均IDF（p=3）
  const selectedAvgIdf = useMemo(() => {
    if (selectedFilters.size === 0) return null;
    const selectedIdolsFiltered = selectedIdols.filter((idol) => selectedFilters.has(idol.id));
    const p = 3;
    const powerSum = selectedIdolsFiltered.reduce(
      (sum, idol) => sum + Math.pow(idol.score.idf, p),
      0
    );
    return Math.pow(powerSum / selectedIdolsFiltered.length, 1 / p);
  }, [selectedFilters, selectedIdols]);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="detail-section">
      <h3>類似アイドル</h3>
      <p className="section-description">
        同じ随伴アイドルを複数選んでいる他のアイドル（共通する随伴の構成でグループ化）
      </p>

      <div
        style={{
          marginBottom: "16px",
          padding: "12px",
          backgroundColor: "#f5f5f5",
          borderRadius: "8px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          <span style={{ fontSize: "12px", color: "#666" }}>随伴アイドルでフィルター:</span>
          {selectedFilters.size > 0 && (
            <button
              onClick={clearFilters}
              style={{
                fontSize: "11px",
                padding: "2px 8px",
                backgroundColor: "#e0e0e0",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              クリア
            </button>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {selectedIdols.map((idol) => {
            const isSelected = selectedFilters.has(idol.id);
            return (
              <button
                key={idol.id}
                onClick={() => toggleFilter(idol.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 8px",
                  backgroundColor: isSelected ? "#8e44ad" : "#fff",
                  color: isSelected ? "#fff" : "inherit",
                  border: isSelected ? "1px solid #8e44ad" : "1px solid #ddd",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                {idol.brand.map((b) => (
                  <BrandDot key={b} brand={b} size="small" />
                ))}
                {idol.name}
                <span
                  style={{
                    fontSize: "10px",
                    opacity: 0.7,
                    marginLeft: "2px",
                  }}
                >
                  ({idol.score.idf.toFixed(2)})
                </span>
              </button>
            );
          })}
        </div>
        {selectedAvgIdf !== null && (
          <div
            style={{
              marginTop: "8px",
              fontSize: "12px",
              color: "#666",
            }}
          >
            選択中の平均IDF: <strong>{selectedAvgIdf.toFixed(2)}</strong>
          </div>
        )}
      </div>

      {filteredGroups.length === 0 ? (
        <p style={{ color: "#666", fontStyle: "italic" }}>
          選択した条件に一致するグループがありません
        </p>
      ) : (
        <ul className="similar-list">
          {filteredGroups.map((group, idx) => (
            <li
              key={idx}
              style={{
                padding: "12px",
                backgroundColor: "#fafafa",
                borderRadius: "8px",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    marginRight: "4px",
                  }}
                >
                  共通随伴:
                </span>
                {group.commonAccompaniments.map((accomp) => {
                  const isHighlighted = selectedFilters.has(accomp.id);
                  return (
                    <a
                      key={accomp.id}
                      href={`/idol/${accomp.id}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "2px 6px",
                        backgroundColor: isHighlighted ? "#f3e5f5" : "#fff",
                        border: isHighlighted ? "1px solid #8e44ad" : "1px solid #ddd",
                        borderRadius: "4px",
                        textDecoration: "none",
                        color: "inherit",
                        fontSize: "12px",
                      }}
                      title={`IDF: ${accomp.idf.toFixed(2)}`}
                    >
                      {accomp.brand.map((b) => (
                        <BrandDot key={b} brand={b} size="small" />
                      ))}
                      {accomp.name}
                    </a>
                  );
                })}
                <span
                  style={{
                    fontSize: "11px",
                    color: "#888",
                    marginLeft: "auto",
                  }}
                >
                  ({group.commonAccompanimentCount}人, IDF平均: {group.avgIdf.toFixed(2)})
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  paddingLeft: "8px",
                  borderLeft: "3px solid #8e44ad",
                }}
              >
                {group.idols.map((idol) => (
                  <a
                    key={idol.id}
                    href={`/idol/${idol.id}`}
                    className="idol-link"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {idol.brand.map((b) => (
                      <BrandDot key={b} brand={b} size="small" />
                    ))}
                    {idol.name}
                  </a>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {selectedFilters.size > 0 && (
        <p style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
          {filteredGroups.length} / {groups.length} グループを表示中
        </p>
      )}
    </div>
  );
}

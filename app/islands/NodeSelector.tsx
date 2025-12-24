import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { Brand } from "@/types";
import { BrandDot } from "../components/shared";
import type { IdolListItem } from "./graphExplorerTypes";

const BRAND_LIST: Brand[] = ["imas", "deremas", "milimas", "sidem", "shiny", "gakuen"];
const OTHER_BRAND = "other" as const;
type ExtendedBrand = Brand | typeof OTHER_BRAND;

const BRAND_LABELS: Record<ExtendedBrand, string> = {
  imas: "765PRO",
  deremas: "シンデレラ",
  milimas: "ミリオン",
  sidem: "SideM",
  shiny: "シャニマス",
  gakuen: "学マス",
  other: "その他",
};

interface Props {
  idolList: IdolListItem[];
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  displayedNodeIds?: Set<string>;
  focusedNodeId?: string | null;
  onFocusNode?: (nodeId: string) => void;
  /** エッジに接続されているノードのID（ボトムアップモードでの孤立ノード判定用） */
  connectedNodeIds?: Set<string> | undefined;
}

type BrandState = "all" | "none" | "partial";

interface IdolsByBrand {
  brand: ExtendedBrand;
  idols: IdolListItem[];
}

function groupIdolsByBrand(idolList: IdolListItem[]): IdolsByBrand[] {
  const brandMap = new Map<ExtendedBrand, IdolListItem[]>();

  // Initialize brand groups
  for (const brand of BRAND_LIST) {
    brandMap.set(brand, []);
  }
  brandMap.set(OTHER_BRAND, []);

  // Group idols by their primary brand
  for (const idol of idolList) {
    if (idol.brand.length === 0) {
      brandMap.get(OTHER_BRAND)!.push(idol);
    } else {
      // Use primary brand (first in array)
      const primaryBrand = idol.brand[0];
      if (primaryBrand && BRAND_LIST.includes(primaryBrand)) {
        brandMap.get(primaryBrand)!.push(idol);
      } else {
        brandMap.get(OTHER_BRAND)!.push(idol);
      }
    }
  }

  // Sort idols by kana within each brand
  for (const idols of brandMap.values()) {
    idols.sort((a, b) => a.kana.localeCompare(b.kana, "ja"));
  }

  // Build result, excluding empty brands
  const result: IdolsByBrand[] = [];
  for (const brand of BRAND_LIST) {
    const idols = brandMap.get(brand)!;
    if (idols.length > 0) {
      result.push({ brand, idols });
    }
  }
  const otherIdols = brandMap.get(OTHER_BRAND)!;
  if (otherIdols.length > 0) {
    result.push({ brand: OTHER_BRAND, idols: otherIdols });
  }

  return result;
}

function getBrandState(brandIdols: IdolListItem[], selectedIds: Set<string>): BrandState {
  const selectedCount = brandIdols.filter((idol) => selectedIds.has(idol.id)).length;
  if (selectedCount === 0) return "none";
  if (selectedCount === brandIdols.length) return "all";
  return "partial";
}

// Separate component to use hooks properly
interface BrandRowProps {
  brand: ExtendedBrand;
  idols: IdolListItem[];
  originalIdols: IdolListItem[];
  selectedIds: Set<string>;
  displayedNodeIds: Set<string> | undefined;
  focusedNodeId: string | null | undefined;
  isExpanded: boolean;
  onToggle: () => void;
  onBrandCheckChange: (brandData: IdolsByBrand) => void;
  onIdolCheckChange: (idolId: string) => void;
  onFocusNode: ((nodeId: string) => void) | undefined;
}

function BrandRow({
  brand,
  idols,
  originalIdols,
  selectedIds,
  displayedNodeIds,
  focusedNodeId,
  isExpanded,
  onToggle,
  onBrandCheckChange,
  onIdolCheckChange,
  onFocusNode,
}: BrandRowProps) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const state = getBrandState(originalIdols, selectedIds);

  // Set indeterminate state
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = state === "partial";
    }
  }, [state]);

  return (
    <div style={{ borderBottom: "1px solid #eee" }}>
      {/* Brand header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px",
          background: "#f9f9f9",
          cursor: "pointer",
        }}
      >
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={state === "all"}
          onChange={() => onBrandCheckChange({ brand, idols: originalIdols })}
          onClick={(e) => e.stopPropagation()}
          style={{ marginRight: "8px" }}
        />
        <div onClick={onToggle} style={{ display: "flex", alignItems: "center", flex: 1 }}>
          {brand !== OTHER_BRAND && <BrandDot brand={brand} size="small" />}
          <span style={{ marginLeft: brand !== OTHER_BRAND ? "6px" : 0, fontWeight: 500 }}>
            {BRAND_LABELS[brand]}
          </span>
          <span style={{ marginLeft: "auto", color: "#999", fontSize: "11px" }}>
            {originalIdols.filter((idol) => selectedIds.has(idol.id)).length}/{originalIdols.length}
          </span>
          <span style={{ marginLeft: "8px", color: "#999" }}>{isExpanded ? "▼" : "▶"}</span>
        </div>
      </div>

      {/* Idol list */}
      {isExpanded && (
        <div style={{ background: "#fff" }}>
          {idols.map((idol) => {
            const isDisplayed = displayedNodeIds?.has(idol.id) ?? false;
            const isFocused = focusedNodeId === idol.id;
            return (
              <div
                key={idol.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "6px 8px 6px 24px",
                  borderTop: "1px solid #f0f0f0",
                  background: isFocused ? "#e3f2fd" : "transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(idol.id)}
                  onChange={() => onIdolCheckChange(idol.id)}
                  style={{ marginRight: "8px", cursor: "pointer" }}
                />
                <span style={{ display: "flex", gap: "2px", marginRight: "6px" }}>
                  {idol.brand.map((b) => (
                    <BrandDot key={b} brand={b} size="small" />
                  ))}
                </span>
                <span
                  onClick={isDisplayed && onFocusNode ? () => onFocusNode(idol.id) : undefined}
                  style={{
                    flex: 1,
                    cursor: isDisplayed && onFocusNode ? "pointer" : "default",
                    color: isDisplayed ? "#1976d2" : "inherit",
                    fontWeight: isFocused ? "bold" : "normal",
                  }}
                  title={isDisplayed ? "クリックでグラフ上のノードにフォーカス" : undefined}
                >
                  {idol.name}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function NodeSelector({
  idolList,
  selectedIds,
  onSelectionChange,
  displayedNodeIds,
  focusedNodeId,
  onFocusNode,
  connectedNodeIds,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBrands, setExpandedBrands] = useState<Set<ExtendedBrand>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const idolsByBrand = useMemo(() => groupIdolsByBrand(idolList), [idolList]);

  // Filter idols by search query
  const filteredIdolsByBrand = useMemo(() => {
    if (!searchQuery.trim()) return idolsByBrand;

    const q = searchQuery.trim().toLowerCase();
    return idolsByBrand
      .map(({ brand, idols }) => ({
        brand,
        idols: idols.filter((idol) => {
          const matchesName = idol.name.replaceAll(/\s/g, "").toLowerCase().includes(q);
          const matchesKana = idol.kana.replaceAll(/\s/g, "").toLowerCase().includes(q);
          return matchesName || matchesKana;
        }),
      }))
      .filter(({ idols }) => idols.length > 0);
  }, [idolsByBrand, searchQuery]);

  // Auto-expand brands when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedBrands(new Set(filteredIdolsByBrand.map(({ brand }) => brand)));
    }
  }, [searchQuery, filteredIdolsByBrand]);

  const toggleBrand = useCallback((brand: ExtendedBrand) => {
    setExpandedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) {
        next.delete(brand);
      } else {
        next.add(brand);
      }
      return next;
    });
  }, []);

  const handleBrandCheckChange = useCallback(
    (brandData: IdolsByBrand) => {
      const state = getBrandState(brandData.idols, selectedIds);
      const newSelectedIds = new Set(selectedIds);

      if (state === "all") {
        // Unselect all in this brand
        for (const idol of brandData.idols) {
          newSelectedIds.delete(idol.id);
        }
      } else {
        // Select all in this brand
        for (const idol of brandData.idols) {
          newSelectedIds.add(idol.id);
        }
      }

      onSelectionChange(newSelectedIds);
    },
    [selectedIds, onSelectionChange]
  );

  const handleIdolCheckChange = useCallback(
    (idolId: string) => {
      const newSelectedIds = new Set(selectedIds);
      if (newSelectedIds.has(idolId)) {
        newSelectedIds.delete(idolId);
      } else {
        newSelectedIds.add(idolId);
      }
      onSelectionChange(newSelectedIds);
    },
    [selectedIds, onSelectionChange]
  );

  const handleSelectAll = useCallback(() => {
    const allIds = new Set(idolList.map((idol) => idol.id));
    onSelectionChange(allIds);
  }, [idolList, onSelectionChange]);

  const handleClearAll = useCallback(() => {
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  // 孤立ノード（エッジに接続されていないノード）を選択解除
  const handleClearIsolatedNodes = useCallback(() => {
    if (!connectedNodeIds) return;
    const newSelectedIds = new Set<string>();
    for (const id of selectedIds) {
      if (connectedNodeIds.has(id)) {
        newSelectedIds.add(id);
      }
    }
    onSelectionChange(newSelectedIds);
  }, [selectedIds, connectedNodeIds, onSelectionChange]);

  // 孤立ノードの数を計算
  const isolatedNodeCount = useMemo(() => {
    if (!connectedNodeIds) return 0;
    let count = 0;
    for (const id of selectedIds) {
      if (!connectedNodeIds.has(id)) {
        count++;
      }
    }
    return count;
  }, [selectedIds, connectedNodeIds]);

  return (
    <div style={{ fontSize: "12px" }}>
      {/* Search input */}
      <input
        ref={searchInputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="アイドルを検索..."
        style={{
          width: "100%",
          padding: "6px 10px",
          fontSize: "12px",
          border: "1px solid #ddd",
          borderRadius: "4px",
          outline: "none",
          marginBottom: "8px",
          boxSizing: "border-box",
        }}
      />

      {/* Quick actions */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
        <button
          onClick={handleSelectAll}
          style={{
            flex: 1,
            padding: "4px 8px",
            fontSize: "11px",
            background: "#e3f2fd",
            color: "#1976d2",
            border: "1px solid #90caf9",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          全選択
        </button>
        <button
          onClick={handleClearAll}
          style={{
            flex: 1,
            padding: "4px 8px",
            fontSize: "11px",
            background: "#fff",
            color: "#666",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          全解除
        </button>
        {connectedNodeIds && (
          <button
            onClick={handleClearIsolatedNodes}
            disabled={isolatedNodeCount === 0}
            style={{
              flex: 1,
              padding: "4px 8px",
              fontSize: "11px",
              background: isolatedNodeCount > 0 ? "#fff3e0" : "#f5f5f5",
              color: isolatedNodeCount > 0 ? "#e65100" : "#999",
              border: isolatedNodeCount > 0 ? "1px solid #ffb74d" : "1px solid #ddd",
              borderRadius: "4px",
              cursor: isolatedNodeCount > 0 ? "pointer" : "default",
            }}
            title={`${isolatedNodeCount}件の孤立ノードを選択解除`}
          >
            孤立解除 ({isolatedNodeCount})
          </button>
        )}
      </div>

      {/* Selection count */}
      <details>
        <summary style={{ color: "#666", fontSize: "11px" }}>
          {selectedIds.size} / {idolList.length} 選択中
        </summary>

        {/* Brand list */}
        <div
          style={{
            maxHeight: "300px",
            overflowY: "auto",
            border: "1px solid #eee",
            borderRadius: "4px",
          }}
        >
          {filteredIdolsByBrand.map(({ brand, idols }) => (
            <BrandRow
              key={brand}
              brand={brand}
              idols={idols}
              originalIdols={idolsByBrand.find((b) => b.brand === brand)?.idols ?? idols}
              selectedIds={selectedIds}
              displayedNodeIds={displayedNodeIds}
              focusedNodeId={focusedNodeId}
              isExpanded={expandedBrands.has(brand)}
              onToggle={() => toggleBrand(brand)}
              onBrandCheckChange={handleBrandCheckChange}
              onIdolCheckChange={handleIdolCheckChange}
              onFocusNode={onFocusNode}
            />
          ))}

          {filteredIdolsByBrand.length === 0 && searchQuery.trim() && (
            <div style={{ padding: "16px", textAlign: "center", color: "#999" }}>
              該当するアイドルが見つかりません
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

// Utility to determine URL representation
export function getSelectionUrlParams(
  selectedIds: Set<string>,
  idolList: IdolListItem[]
): { brands?: string; ids?: string } {
  if (selectedIds.size === 0) return {};
  if (selectedIds.size === idolList.length) return { brands: "all" };

  const idolsByBrand = groupIdolsByBrand(idolList);
  const fullySelectedBrands: ExtendedBrand[] = [];
  const partiallySelectedIds: string[] = [];

  for (const { brand, idols } of idolsByBrand) {
    const state = getBrandState(idols, selectedIds);
    if (state === "all") {
      fullySelectedBrands.push(brand);
    } else if (state === "partial") {
      for (const idol of idols) {
        if (selectedIds.has(idol.id)) {
          partiallySelectedIds.push(idol.id);
        }
      }
    }
  }

  const result: { brands?: string; ids?: string } = {};

  if (fullySelectedBrands.length > 0) {
    result.brands = fullySelectedBrands.join(",");
  }
  if (partiallySelectedIds.length > 0) {
    result.ids = partiallySelectedIds.join(",");
  }

  return result;
}

// Utility to parse URL params to selection
export function parseSelectionFromUrl(
  params: URLSearchParams,
  idolList: IdolListItem[]
): Set<string> {
  const selectedIds = new Set<string>();

  const brandsParam = params.get("brands");
  const idsParam = params.get("ids");

  if (brandsParam) {
    const brands = brandsParam.split(",");
    if (brands.includes("all")) {
      // Select all
      for (const idol of idolList) {
        selectedIds.add(idol.id);
      }
      return selectedIds;
    }

    const idolsByBrand = groupIdolsByBrand(idolList);
    for (const brand of brands) {
      const brandData = idolsByBrand.find((b) => b.brand === brand);
      if (brandData) {
        for (const idol of brandData.idols) {
          selectedIds.add(idol.id);
        }
      }
    }
  }

  if (idsParam) {
    const ids = idsParam.split(",");
    for (const id of ids) {
      if (idolList.some((idol) => idol.id === id)) {
        selectedIds.add(id);
      }
    }
  }

  // Backward compatibility: support old preset param
  const presetParam = params.get("preset");
  if (presetParam && selectedIds.size === 0) {
    if (presetParam === "all") {
      for (const idol of idolList) {
        selectedIds.add(idol.id);
      }
    } else if (BRAND_LIST.includes(presetParam as Brand)) {
      const idolsByBrand = groupIdolsByBrand(idolList);
      const brandData = idolsByBrand.find((b) => b.brand === presetParam);
      if (brandData) {
        for (const idol of brandData.idols) {
          selectedIds.add(idol.id);
        }
      }
    }
  }

  // Backward compatibility: support old ids param format
  const oldIdsParam = params.get("ids");
  if (oldIdsParam && !brandsParam && selectedIds.size === 0) {
    const ids = oldIdsParam.split(",");
    for (const id of ids) {
      if (idolList.some((idol) => idol.id === id)) {
        selectedIds.add(id);
      }
    }
  }

  return selectedIds;
}

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { BrandDot } from "../components/shared";
import type { IdolListItem, ExplorerNode } from "./graphExplorerTypes";

interface Props {
  idolList: IdolListItem[];
  onSelect: (idol: IdolListItem) => void;
  existingNodeIds: Map<string, ExplorerNode>;
}

export default function IdolSearchBox({ idolList, onSelect, existingNodeIds }: Props) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredIdols = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return idolList
      .filter((idol) => {
        const matchesName = idol.name.replaceAll(/\s/g, "").toLowerCase().includes(q);
        const matchesKana = idol.kana.replaceAll(/\s/g, "").toLowerCase().includes(q);
        return matchesName || matchesKana;
      })
      .slice(0, 20);
  }, [idolList, query]);

  const handleSelect = useCallback(
    (idol: IdolListItem) => {
      onSelect(idol);
      setQuery("");
      setIsOpen(false);
      setHighlightIndex(0);
    },
    [onSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || filteredIdols.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIndex((prev) => Math.min(prev + 1, filteredIdols.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredIdols[highlightIndex]) {
            handleSelect(filteredIdols[highlightIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          break;
      }
    },
    [isOpen, filteredIdols, highlightIndex, handleSelect]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset highlight when results change
  useEffect(() => {
    setHighlightIndex(0);
  }, [filteredIdols]);

  return (
    <div ref={containerRef} style={{ position: "relative", maxWidth: "400px" }}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="アイドルを検索（名前 or かな）..."
        style={{
          width: "100%",
          padding: "8px 12px",
          fontSize: "14px",
          border: "1px solid #ddd",
          borderRadius: "4px",
          outline: "none",
        }}
      />

      {isOpen && filteredIdols.length > 0 && (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            maxHeight: "300px",
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #ddd",
            borderTop: "none",
            borderRadius: "0 0 4px 4px",
            margin: 0,
            padding: 0,
            listStyle: "none",
            zIndex: 1000,
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          {filteredIdols.map((idol, index) => {
            const isExisting = existingNodeIds.has(idol.id);
            const isHighlighted = index === highlightIndex;

            return (
              <li
                key={idol.id}
                onClick={() => handleSelect(idol)}
                onMouseEnter={() => setHighlightIndex(index)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: isHighlighted ? "#f0f0f0" : isExisting ? "#f9f9f9" : "#fff",
                  borderBottom: "1px solid #eee",
                }}
              >
                <span style={{ display: "flex", gap: "2px" }}>
                  {idol.brand.map((b) => (
                    <BrandDot key={b} brand={b} size="small" />
                  ))}
                </span>
                <span style={{ flex: 1 }}>
                  {idol.name}
                  {idol.kana && (
                    <span style={{ fontSize: "11px", color: "#999", marginLeft: "8px" }}>
                      {idol.kana}
                    </span>
                  )}
                </span>
                {isExisting && (
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#666",
                      background: "#e0e0e0",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    追加済
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {isOpen && query.trim() && filteredIdols.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            padding: "12px",
            background: "#fff",
            border: "1px solid #ddd",
            borderTop: "none",
            borderRadius: "0 0 4px 4px",
            color: "#999",
            textAlign: "center",
            zIndex: 1000,
          }}
        >
          該当するアイドルが見つかりません
        </div>
      )}
    </div>
  );
}

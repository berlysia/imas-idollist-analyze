import { useState, useMemo } from "react";
import type { Brand } from "../types";
import { BRAND_COLORS, BRAND_NAMES, ALL_BRANDS } from "../lib/constants";

interface IdolListItem {
  id: string;
  name: string;
  brand: Brand[];
  kana?: string | undefined;
}

interface Props {
  idols: IdolListItem[];
}

function BrandDot({ brand }: { brand: Brand }) {
  return (
    <span
      className="brand-dot"
      style={{ backgroundColor: BRAND_COLORS[brand] }}
      title={BRAND_NAMES[brand]}
    />
  );
}

export default function IdolList({ idols }: Props) {
  const [selectedBrands, setSelectedBrands] = useState<Brand[]>(ALL_BRANDS);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredIdols = useMemo(() => {
    return idols.filter((idol) => {
      // ブランドフィルター
      const matchesBrand = idol.brand.some((b) => selectedBrands.includes(b));
      if (!matchesBrand) return false;

      // 検索フィルター
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = idol.name.toLowerCase().includes(query);
        const matchesKana = idol.kana?.toLowerCase().includes(query) ?? false;
        return matchesName || matchesKana;
      }

      return true;
    });
  }, [idols, selectedBrands, searchQuery]);

  // 五十音順にソート（kanaがある場合はkanaで、なければnameで）
  const sortedIdols = useMemo(() => {
    return [...filteredIdols].sort((a, b) => {
      const aSort = a.kana ?? a.name;
      const bSort = b.kana ?? b.name;
      return aSort.localeCompare(bSort, "ja");
    });
  }, [filteredIdols]);

  const handleBrandChange = (brand: Brand, checked: boolean) => {
    setSelectedBrands((prev) => {
      const newBrands = checked ? [...prev, brand] : prev.filter((b) => b !== brand);
      return newBrands.length > 0 ? newBrands : prev;
    });
  };

  return (
    <>
      <section className="filters" style={{ marginBottom: "16px" }}>
        <div className="brand-filters">
          <span>ブランド:</span>
          {ALL_BRANDS.map((brand) => (
            <label key={brand} className={`brand-checkbox brand-${brand}`}>
              <input
                type="checkbox"
                checked={selectedBrands.includes(brand)}
                onChange={(e) => handleBrandChange(brand, e.target.checked)}
              />
              {BRAND_NAMES[brand]}
            </label>
          ))}
        </div>
        <div className="search-filter" style={{ marginTop: "8px" }}>
          <label>
            <span style={{ marginRight: "8px" }}>検索:</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="名前・読み仮名で検索..."
              style={{
                padding: "4px 8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                width: "250px",
              }}
            />
          </label>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                marginLeft: "8px",
                padding: "4px 8px",
                background: "#e0e0e0",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              クリア
            </button>
          )}
        </div>
      </section>

      <p style={{ marginBottom: "12px", color: "#666" }}>
        {sortedIdols.length}人のアイドルを表示中
        {searchQuery && ` (「${searchQuery}」で検索)`}
      </p>

      <table className="pmi-table">
        <thead>
          <tr>
            <th>アイドル</th>
            <th>読み</th>
            <th>ブランド</th>
          </tr>
        </thead>
        <tbody>
          {sortedIdols.map((idol) => (
            <tr key={idol.id}>
              <td>
                <a
                  href={`/idol/${idol.id}`}
                  className="idol-name clickable"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  {idol.brand.map((b) => (
                    <BrandDot key={b} brand={b} />
                  ))}
                  {idol.name}
                </a>
              </td>
              <td style={{ color: "#666", fontSize: "0.9rem" }}>{idol.kana ?? "-"}</td>
              <td>
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {idol.brand.map((brand) => (
                    <span key={brand} className={`brand-tag brand-${brand}`}>
                      {BRAND_NAMES[brand]}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {sortedIdols.length === 0 && (
        <p style={{ textAlign: "center", color: "#999", padding: "32px" }}>
          該当するアイドルが見つかりませんでした
        </p>
      )}
    </>
  );
}

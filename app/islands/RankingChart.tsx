import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { Brand } from "@/types";
import { BRAND_COLORS, BRAND_NAMES, ALL_BRANDS } from "../lib/constants";

interface CooccurrenceStats {
  id: string;
  name: string;
  brand: Brand[];
  count: number;
  byBrand: Record<Brand, number>;
}

interface Props {
  stats: CooccurrenceStats[];
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

export default function RankingChart({ stats }: Props) {
  const [selectedBrands, setSelectedBrands] = useState<Brand[]>(ALL_BRANDS);
  const [page, setPage] = useState(0);
  const itemsPerPage = 50;

  const filteredStats = useMemo(() => {
    return stats.filter((stat) => stat.brand.some((b) => selectedBrands.includes(b)));
  }, [stats, selectedBrands]);

  const totalPages = Math.ceil(filteredStats.length / itemsPerPage);
  const currentStats = filteredStats.slice(page * itemsPerPage, (page + 1) * itemsPerPage);

  const chartData = currentStats.map((stat) => ({
    id: stat.id,
    name: stat.name,
    count: stat.count,
    brand: stat.brand,
  }));

  // 1人あたり28pxの高さを確保（最小400px）
  const chartHeight = Math.max(400, chartData.length * 28);

  const handleBrandChange = (brand: Brand, checked: boolean) => {
    setSelectedBrands((prev) => {
      const newBrands = checked ? [...prev, brand] : prev.filter((b) => b !== brand);
      return newBrands.length > 0 ? newBrands : prev;
    });
    setPage(0);
  };

  const handleBarClick = (data: { id: string }) => {
    window.location.href = `/idol/${data.id}`;
  };

  return (
    <div className="chart-container">
      <h3>被共起数ランキング</h3>
      <p className="chart-hint">各アイドルがどれだけ多くのアイドルから選ばれたかを表示</p>

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
      </section>

      <p className="chart-count" style={{ marginBottom: "8px" }}>
        {filteredStats.length}人のアイドル
      </p>

      <div style={{ width: "100%", height: chartHeight, marginBottom: "24px" }}>
        <ResponsiveContainer>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
            <Tooltip formatter={(value: number) => [`${value}人`, "被共起数"]} />
            <Bar
              dataKey="count"
              cursor="pointer"
              onClick={(data) => handleBarClick(data as { id: string })}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.id}
                  fill={entry.brand[0] ? BRAND_COLORS[entry.brand[0]] : "#666"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <table className="pmi-table">
        <thead>
          <tr>
            <th className="rank">順位</th>
            <th>アイドル</th>
            <th className="count">被共起数</th>
            <th>ブランド別</th>
          </tr>
        </thead>
        <tbody>
          {currentStats.map((stat, index) => (
            <tr key={stat.id}>
              <td className="rank">{page * itemsPerPage + index + 1}</td>
              <td>
                <a
                  href={`/idol/${stat.id}`}
                  className="idol-name clickable"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  {stat.brand.map((b) => (
                    <BrandDot key={b} brand={b} />
                  ))}
                  {stat.name}
                </a>
              </td>
              <td className="count">{stat.count}人</td>
              <td>
                <div
                  className="brand-breakdown"
                  style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}
                >
                  {(Object.entries(stat.byBrand) as [Brand, number][])
                    .filter(([, count]) => count > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([brand, count]) => (
                      <span
                        key={brand}
                        className={`brand-tag brand-${brand}`}
                        style={{ fontSize: "0.75rem" }}
                      >
                        {BRAND_NAMES[brand]}: {count}
                      </span>
                    ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div
          className="pagination"
          style={{
            marginTop: "16px",
            display: "flex",
            gap: "8px",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: "8px 16px",
              cursor: page === 0 ? "not-allowed" : "pointer",
              opacity: page === 0 ? 0.5 : 1,
            }}
          >
            前へ
          </button>
          <span>
            {page + 1} / {totalPages} ページ
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            style={{
              padding: "8px 16px",
              cursor: page === totalPages - 1 ? "not-allowed" : "pointer",
              opacity: page === totalPages - 1 ? 0.5 : 1,
            }}
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}

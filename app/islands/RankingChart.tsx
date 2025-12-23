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

const CHART_LIMIT_OPTIONS = [20, 50, 100, 0] as const;

export default function RankingChart({ stats }: Props) {
  const [selectedBrands, setSelectedBrands] = useState<Brand[]>(ALL_BRANDS);
  const [chartLimit, setChartLimit] = useState<number>(50);

  const filteredStats = useMemo(() => {
    return stats.filter((stat) => stat.brand.some((b) => selectedBrands.includes(b)));
  }, [stats, selectedBrands]);

  const chartData = useMemo(() => {
    const limited = chartLimit === 0 ? filteredStats : filteredStats.slice(0, chartLimit);
    return limited.map((stat) => ({
      id: stat.id,
      name: stat.name,
      count: stat.count,
      brand: stat.brand,
    }));
  }, [filteredStats, chartLimit]);

  // 1人あたり28pxの高さを確保（最小400px）
  const chartHeight = Math.max(400, chartData.length * 28);

  const handleBrandChange = (brand: Brand, checked: boolean) => {
    setSelectedBrands((prev) => {
      const newBrands = checked ? [...prev, brand] : prev.filter((b) => b !== brand);
      return newBrands.length > 0 ? newBrands : prev;
    });
  };

  const handleBarClick = (data: { id: string }) => {
    window.location.href = `/idol/${data.id}`;
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
        <div className="chart-limit-filter" style={{ marginTop: "8px" }}>
          <span>グラフ表示件数:</span>
          {CHART_LIMIT_OPTIONS.map((limit) => (
            <label key={limit} style={{ marginLeft: "8px" }}>
              <input
                type="radio"
                name="chartLimit"
                checked={chartLimit === limit}
                onChange={() => setChartLimit(limit)}
              />
              {limit === 0 ? "全件" : `${limit}件`}
            </label>
          ))}
        </div>
      </section>

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
          {filteredStats.map((stat, index) => (
            <tr key={stat.id}>
              <td className="rank">{index + 1}</td>
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
    </>
  );
}

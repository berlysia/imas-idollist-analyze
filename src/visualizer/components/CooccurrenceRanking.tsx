import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { CooccurrenceStats } from "../hooks/useCooccurrenceData";
import type { Brand } from "@/types";
import { BRAND_COLORS } from "../constants";

interface Props {
  stats: CooccurrenceStats[];
  limit?: number;
  title?: string;
  onIdolClick?: (idolId: string) => void;
}

function getPrimaryColor(brands: Brand[]): string {
  const first = brands[0];
  if (!first) return "#666";
  return BRAND_COLORS[first];
}

export function CooccurrenceRanking({
  stats,
  limit = 20,
  title = "共起数ランキング",
  onIdolClick,
}: Props) {
  const displayData = stats.slice(0, limit).map((s, i) => ({
    id: s.id,
    rank: i + 1,
    name: s.name,
    count: s.count,
    brand: s.brand,
  }));

  const chartHeight = Math.max(400, displayData.length * 25);

  const handleBarClick = (data: (typeof displayData)[number]) => {
    if (onIdolClick) {
      onIdolClick(data.id);
    }
  };

  return (
    <div className="chart-container">
      <h3>{title}</h3>
      <p className="chart-hint">バーをクリックするとアイドル詳細を表示</p>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={displayData}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
        >
          <XAxis type="number" />
          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} interval={0} />
          <Tooltip
            formatter={(value: number) => [`${value}人`, "被共起数"]}
            labelFormatter={(name) => {
              const item = displayData.find((d) => d.name === name);
              return item ? `${item.rank}位: ${name}` : name;
            }}
          />
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            onClick={(data) => data && handleBarClick(data as (typeof displayData)[number])}
            style={{ cursor: onIdolClick ? "pointer" : "default" }}
          >
            {displayData.map((entry, index) => (
              <Cell key={index} fill={getPrimaryColor(entry.brand)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

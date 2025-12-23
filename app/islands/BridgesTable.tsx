import type { Brand } from "@/types";
import { BRAND_COLORS, BRAND_NAMES } from "../lib/constants";

interface IdolInfo {
  id: string;
  name: string;
  brand: Brand[];
}

interface CrossBrandBridge {
  idolA: IdolInfo;
  idolB: IdolInfo;
  voterCount: number;
  pmi: number;
  voters: IdolInfo[];
}

interface Props {
  bridges: CrossBrandBridge[];
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

export default function BridgesTable({ bridges }: Props) {
  return (
    <>
      <p className="bridges-count">{bridges.length} ペア</p>

      <table className="bridges-table">
        <thead>
          <tr>
            <th className="rank">順位</th>
            <th>アイドルA</th>
            <th className="arrow">↔</th>
            <th>アイドルB</th>
            <th className="voter-count">投票者数</th>
            <th className="pmi-value">PMI</th>
          </tr>
        </thead>
        <tbody>
          {bridges.map((bridge, index) => (
            <tr key={`${bridge.idolA.id}-${bridge.idolB.id}`} className="bridge-row">
              <td className="rank">{index + 1}</td>
              <td>
                <a
                  href={`/idol/${bridge.idolA.id}`}
                  className="idol-name clickable"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  {bridge.idolA.brand.map((b) => (
                    <BrandDot key={b} brand={b} />
                  ))}
                  {bridge.idolA.name}
                </a>
              </td>
              <td className="arrow">↔</td>
              <td>
                <a
                  href={`/idol/${bridge.idolB.id}`}
                  className="idol-name clickable"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  {bridge.idolB.brand.map((b) => (
                    <BrandDot key={b} brand={b} />
                  ))}
                  {bridge.idolB.name}
                </a>
              </td>
              <td className="voter-count">{bridge.voterCount}人</td>
              <td className="pmi-value">{bridge.pmi.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

import { useState, useMemo } from "react";
import type { Brand } from "@/types";
import { BRAND_COLORS, BRAND_NAMES } from "../lib/constants";

interface IdolInfo {
  id: string;
  name: string;
  brand: Brand[];
}

interface PairCooccurrence {
  idolA: IdolInfo;
  idolB: IdolInfo;
  count: number;
  pmi: number;
  crossBrand: boolean;
}

interface Props {
  pairs: PairCooccurrence[];
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

export default function PMIFilter({ pairs }: Props) {
  const [crossBrandOnly, setCrossBrandOnly] = useState(false);

  const filteredPairs = useMemo(() => {
    if (crossBrandOnly) {
      return pairs.filter((p) => p.crossBrand);
    }
    return pairs;
  }, [pairs, crossBrandOnly]);

  const handleCrossBrandChange = (checked: boolean) => {
    setCrossBrandOnly(checked);
  };

  return (
    <div className="pmi-ranking">
      <div className="pmi-explanation">
        <p>
          <strong>相思相愛ペア</strong>
          とは、互いに共起として選び合っているアイドルのペアです。
        </p>
        <p>
          PMI（Pointwise Mutual Information）値は、このペアが偶然選ばれた場合に比べて
          どれだけ高い確率で共起しているかを示します。 値が高いほど「意外性のある関係」です。
        </p>
      </div>

      <section className="filters" style={{ marginBottom: "16px" }}>
        <label className="brand-checkbox" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={crossBrandOnly}
            onChange={(e) => handleCrossBrandChange(e.target.checked)}
          />
          ブランド横断ペアのみ表示
        </label>
      </section>

      <p className="pmi-count">
        {filteredPairs.length} ペア
        {crossBrandOnly && ` (横断のみ: ${pairs.filter((p) => p.crossBrand).length})`}
      </p>

      <table className="pmi-table">
        <thead>
          <tr>
            <th className="rank">順位</th>
            <th>アイドルA</th>
            <th className="arrow">↔</th>
            <th>アイドルB</th>
            <th className="count">共起数</th>
            <th className="pmi-value">PMI</th>
            <th className="cross-brand-indicator">横断</th>
          </tr>
        </thead>
        <tbody>
          {filteredPairs.map((pair, index) => (
            <tr
              key={`${pair.idolA.id}-${pair.idolB.id}`}
              className={pair.crossBrand ? "cross-brand" : ""}
            >
              <td className="rank">{index + 1}</td>
              <td>
                <a
                  href={`/idol/${pair.idolA.id}`}
                  className="idol-name clickable"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  {pair.idolA.brand.map((b) => (
                    <BrandDot key={b} brand={b} />
                  ))}
                  {pair.idolA.name}
                </a>
              </td>
              <td className="arrow">↔</td>
              <td>
                <a
                  href={`/idol/${pair.idolB.id}`}
                  className="idol-name clickable"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  {pair.idolB.brand.map((b) => (
                    <BrandDot key={b} brand={b} />
                  ))}
                  {pair.idolB.name}
                </a>
              </td>
              <td className="count">{pair.count}</td>
              <td className="pmi-value">{pair.pmi.toFixed(2)}</td>
              <td className="cross-brand-indicator">{pair.crossBrand ? "✓" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

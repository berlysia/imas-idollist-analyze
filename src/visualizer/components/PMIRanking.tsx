import type { PairCooccurrence } from "../hooks/useCooccurrenceData";
import type { Brand } from "@/types";
import { BRAND_COLORS } from "../constants";

interface Props {
  pairs: PairCooccurrence[];
  limit?: number;
  showCrossBrandOnly?: boolean;
  onIdolClick?: (idolId: string) => void;
}

function getBrandColor(brands: Brand[]): string {
  const first = brands[0];
  if (!first) return "#666";
  return BRAND_COLORS[first];
}

function formatPMI(pmi: number): string {
  return pmi.toFixed(2);
}

export function PMIRanking({ pairs, limit = 30, showCrossBrandOnly = false, onIdolClick }: Props) {
  const filteredPairs = showCrossBrandOnly ? pairs.filter((p) => p.crossBrand) : pairs;
  const displayPairs = filteredPairs.slice(0, limit);
  const crossBrandCount = filteredPairs.filter((p) => p.crossBrand).length;

  return (
    <div className="pmi-ranking">
      <div className="pmi-explanation">
        <p>
          <strong>相思相愛ペア</strong>：お互いを共演アイドルとして選び合っているペアです。
          （AがBを選び、かつBもAを選んでいる = 共起数2）
        </p>
        <p>
          <strong>PMI（Pointwise Mutual Information）</strong>で並べ替えることで、
          人気に関係なく「特別に選び合っている」ペアが上位に来ます。
          PMIが高いほど、それぞれの人気から期待される確率より高い頻度で選び合っています。
        </p>
      </div>

      <p className="pmi-count">
        該当ペア: {filteredPairs.length}件（うちブランド横断: {crossBrandCount}件）
        {displayPairs.length < filteredPairs.length && ` / 表示: ${displayPairs.length}件`}
      </p>

      <table className="pmi-table">
        <thead>
          <tr>
            <th>順位</th>
            <th>アイドルA</th>
            <th></th>
            <th>アイドルB</th>
            <th>共起数</th>
            <th>PMI</th>
            <th>ブランド横断</th>
          </tr>
        </thead>
        <tbody>
          {displayPairs.map((pair, index) => (
            <tr
              key={`${pair.idolA.id}-${pair.idolB.id}`}
              className={pair.crossBrand ? "cross-brand" : ""}
            >
              <td className="rank">{index + 1}</td>
              <td className="idol-name clickable" onClick={() => onIdolClick?.(pair.idolA.id)}>
                <span
                  className="brand-dot"
                  style={{ backgroundColor: getBrandColor(pair.idolA.brand) }}
                />
                {pair.idolA.name}
              </td>
              <td className="arrow">↔</td>
              <td className="idol-name clickable" onClick={() => onIdolClick?.(pair.idolB.id)}>
                <span
                  className="brand-dot"
                  style={{ backgroundColor: getBrandColor(pair.idolB.brand) }}
                />
                {pair.idolB.name}
              </td>
              <td className="count">{pair.count}</td>
              <td className="pmi-value">{formatPMI(pair.pmi)}</td>
              <td className="cross-brand-indicator">{pair.crossBrand ? "✓" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

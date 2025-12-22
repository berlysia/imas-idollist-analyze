import { useState } from "react";
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
  const [page, setPage] = useState(0);
  const itemsPerPage = 50;

  const totalPages = Math.ceil(bridges.length / itemsPerPage);
  const currentBridges = bridges.slice(page * itemsPerPage, (page + 1) * itemsPerPage);

  return (
    <div className="cross-brand-bridges">
      <div className="bridges-explanation">
        <p>
          <strong>ブランド横断ペア</strong>
          とは、異なるブランドのアイドル2人が、複数のアイドルから同時に共起として選ばれているペアです。
        </p>
        <p>
          投票者数が多いほど、ブランドを超えた人気の組み合わせであることを示します。
          PMI値は、このペアが偶然選ばれた場合と比較した「意外性」を示します。
        </p>
      </div>

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
          {currentBridges.map((bridge, index) => (
            <tr key={`${bridge.idolA.id}-${bridge.idolB.id}`} className="bridge-row">
              <td className="rank">{page * itemsPerPage + index + 1}</td>
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

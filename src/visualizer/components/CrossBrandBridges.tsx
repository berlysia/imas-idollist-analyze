import { useState } from "react";
import type { CrossBrandBridge } from "../hooks/useCooccurrenceData";
import type { Brand } from "@/types";
import { BRAND_COLORS } from "../constants";

interface Props {
  bridges: CrossBrandBridge[];
  pageSize?: number;
  onIdolClick?: (idolId: string) => void;
}

type SortMode = "voters" | "pmi";
const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

function getBrandColor(brands: Brand[]): string {
  const first = brands[0];
  if (!first) return "#666";
  return BRAND_COLORS[first];
}

function formatPMI(pmi: number): string {
  return pmi.toFixed(2);
}

export function CrossBrandBridges({ bridges, pageSize: initialPageSize = 50, onIdolClick }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("pmi");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const sortedBridges = [...bridges].sort((a, b) =>
    sortMode === "pmi" ? b.pmi - a.pmi : b.voterCount - a.voterCount
  );

  const totalPages = Math.ceil(sortedBridges.length / pageSize);
  const startIndex = currentPage * pageSize;
  const displayBridges = sortedBridges.slice(startIndex, startIndex + pageSize);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(0);
  };

  const handleSortModeChange = (mode: SortMode) => {
    setSortMode(mode);
    setCurrentPage(0);
  };

  return (
    <div className="cross-brand-bridges">
      <div className="bridges-explanation">
        <p>
          <strong>ブランド横断ペア</strong>
          ：異なるブランドの2人が、複数のアイドルから同時に「共演アイドル」として選ばれているペアです。
        </p>
        <p>
          「選んだ人数」が多いほど、多くのアイドルがこの2人を同時に選んでいます。
          <strong>PMI</strong>
          でソートすると、それぞれの人気から期待される確率より高い頻度で同時に選ばれている「意外なペア」が上位に来ます。
        </p>
      </div>

      <div className="bridges-controls">
        <span>ソート:</span>
        <button
          className={sortMode === "voters" ? "active" : ""}
          onClick={() => handleSortModeChange("voters")}
        >
          選んだ人数順
        </button>
        <button
          className={sortMode === "pmi" ? "active" : ""}
          onClick={() => handleSortModeChange("pmi")}
        >
          PMI順（意外性）
        </button>

        <span className="page-size-label">表示件数:</span>
        {PAGE_SIZE_OPTIONS.map((size) => (
          <button
            key={size}
            className={pageSize === size ? "active" : ""}
            onClick={() => handlePageSizeChange(size)}
          >
            {size}
          </button>
        ))}
      </div>

      <div className="bridges-info">
        <span className="bridges-count">該当ペア: {bridges.length}件</span>
        <span className="bridges-page-info">
          {startIndex + 1}〜{Math.min(startIndex + pageSize, bridges.length)}件目
        </span>
      </div>

      <table className="bridges-table">
        <thead>
          <tr>
            <th>順位</th>
            <th>アイドルA</th>
            <th></th>
            <th>アイドルB</th>
            <th>選んだ人数</th>
            <th>PMI</th>
          </tr>
        </thead>
        <tbody>
          {displayBridges.map((bridge, index) => {
            const rowKey = `${bridge.idolA.id}-${bridge.idolB.id}`;
            const isExpanded = expandedRow === rowKey;

            return (
              <>
                <tr
                  key={rowKey}
                  className={`bridge-row ${isExpanded ? "expanded" : ""}`}
                  onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                >
                  <td className="rank">{startIndex + index + 1}</td>
                  <td
                    className="idol-name clickable"
                    onClick={(e) => {
                      e.stopPropagation();
                      onIdolClick?.(bridge.idolA.id);
                    }}
                  >
                    <span
                      className="brand-dot"
                      style={{ backgroundColor: getBrandColor(bridge.idolA.brand) }}
                    />
                    {bridge.idolA.name}
                  </td>
                  <td className="arrow">&amp;</td>
                  <td
                    className="idol-name clickable"
                    onClick={(e) => {
                      e.stopPropagation();
                      onIdolClick?.(bridge.idolB.id);
                    }}
                  >
                    <span
                      className="brand-dot"
                      style={{ backgroundColor: getBrandColor(bridge.idolB.brand) }}
                    />
                    {bridge.idolB.name}
                  </td>
                  <td className="voter-count">{bridge.voterCount}人</td>
                  <td className="pmi-value">{formatPMI(bridge.pmi)}</td>
                </tr>
                {isExpanded && (
                  <tr key={`${rowKey}-voters`} className="voters-row">
                    <td colSpan={6}>
                      <div className="voters-list">
                        <strong>選んだアイドル:</strong>
                        <span className="voters">
                          {bridge.voters.map((voter, i) => (
                            <span key={voter.id} className="voter">
                              <button
                                className="voter-link"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onIdolClick?.(voter.id);
                                }}
                              >
                                <span
                                  className="brand-dot small"
                                  style={{ backgroundColor: getBrandColor(voter.brand) }}
                                />
                                {voter.name}
                              </button>
                              {i < bridge.voters.length - 1 && "、"}
                            </span>
                          ))}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={currentPage === 0} onClick={() => setCurrentPage(0)}>
            {"<<"}
          </button>
          <button disabled={currentPage === 0} onClick={() => setCurrentPage((p) => p - 1)}>
            {"<"}
          </button>
          <span className="page-indicator">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages - 1}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            {">"}
          </button>
          <button
            disabled={currentPage >= totalPages - 1}
            onClick={() => setCurrentPage(totalPages - 1)}
          >
            {">>"}
          </button>
        </div>
      )}
    </div>
  );
}

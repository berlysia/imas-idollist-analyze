import type { IdolDetail as IdolDetailType } from "../hooks/useCooccurrenceData";
import { getBrandName } from "../hooks/useCooccurrenceData";
import type { Brand } from "@/types";
import { BRAND_COLORS } from "../constants";

interface Props {
  detail: IdolDetailType;
  onBack: () => void;
  onIdolClick: (idolId: string) => void;
}

function getBrandColor(brands: Brand[]): string {
  const first = brands[0];
  if (!first) return "#666";
  return BRAND_COLORS[first];
}

function formatPMI(pmi: number): string {
  return pmi.toFixed(2);
}

function IdolLink({
  idol,
  onClick,
}: {
  idol: { id: string; name: string; brand: Brand[] };
  onClick: (id: string) => void;
}) {
  return (
    <button className="idol-link" onClick={() => onClick(idol.id)}>
      <span className="brand-dot" style={{ backgroundColor: getBrandColor(idol.brand) }} />
      {idol.name}
    </button>
  );
}

export function IdolDetail({ detail, onBack, onIdolClick }: Props) {
  const brandNames = detail.brand.map((b) => getBrandName(b)).join(" / ");

  return (
    <div className="idol-detail">
      <button className="back-button" onClick={onBack}>
        ← 一覧に戻る
      </button>

      <header className="idol-header">
        <h2>
          <span
            className="brand-dot large"
            style={{ backgroundColor: getBrandColor(detail.brand) }}
          />
          {detail.name}
        </h2>
        <p className="brand-info">{brandNames}</p>
        <a href={detail.link} target="_blank" rel="noopener noreferrer" className="official-link">
          公式ページ →
        </a>
      </header>

      <section className="detail-section">
        <h3>被共起数（このアイドルを選んだ人）</h3>
        <p className="stat-number">{detail.incomingCount}人から選出</p>
        <div className="brand-breakdown">
          {(Object.entries(detail.incomingByBrand) as [Brand, number][])
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([brand, count]) => (
              <span key={brand} className={`brand-tag brand-${brand}`}>
                {getBrandName(brand)}: {count}
              </span>
            ))}
        </div>
        {detail.selectedBy.length > 0 && (
          <ul className="idol-list compact" style={{ marginTop: "12px" }}>
            {detail.selectedBy.map((idol) => (
              <li key={idol.id}>
                <IdolLink idol={idol} onClick={onIdolClick} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="detail-section">
        <h3>選出先（このアイドルが選んだ人）</h3>
        <p className="section-description">{detail.selectedIdols.length}人</p>
        {detail.selectedIdols.length > 0 ? (
          <ul className="idol-list compact">
            {detail.selectedIdols.map((idol) => (
              <li key={idol.id}>
                <IdolLink idol={idol} onClick={onIdolClick} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-message">なし</p>
        )}
      </section>

      <section className="detail-section">
        <h3>相思相愛ペア</h3>
        <p className="section-description">お互いを共演アイドルとして選び合っている</p>
        {detail.mutualPairs.length > 0 ? (
          <ul className="idol-list">
            {detail.mutualPairs.map((partner) => (
              <li key={partner.id}>
                <IdolLink idol={partner} onClick={onIdolClick} />
                <span className="pmi-badge">PMI: {formatPMI(partner.pmi)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-message">なし</p>
        )}
      </section>

      <section className="detail-section">
        <h3>ブランド横断ペア</h3>
        <p className="section-description">
          異なるブランドのアイドルと同時に複数人から選出されている
        </p>
        {detail.crossBrandBridges.length > 0 ? (
          <ul className="bridge-list">
            {detail.crossBrandBridges.map((bridge) => (
              <li key={bridge.partner.id}>
                <div className="bridge-header">
                  <IdolLink idol={bridge.partner} onClick={onIdolClick} />
                  <span className="voter-badge">{bridge.voterCount}人から同時選出</span>
                  <span className="pmi-badge">PMI: {formatPMI(bridge.pmi)}</span>
                </div>
                <div className="bridge-voters">
                  選んだアイドル:{" "}
                  {bridge.voters.map((voter, i) => (
                    <span key={voter.id}>
                      <IdolLink idol={voter} onClick={onIdolClick} />
                      {i < bridge.voters.length - 1 && "、"}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-message">なし</p>
        )}
      </section>
    </div>
  );
}

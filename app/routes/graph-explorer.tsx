import { createRoute } from "honox/factory";
import GraphExplorer from "../islands/GraphExplorer";
import { SITE_TITLE } from "../lib/constants";
import { loadGraphExplorerData } from "../lib/graphExplorerData";

export default createRoute(async (c) => {
  const {
    idolList,
    normalized,
    idfMap,
    pmiMap,
    cooccurrenceCompanionPairs,
    similarByAccompanimentPairs,
  } = await loadGraphExplorerData();

  return c.render(
    <div
      data-fullscreen
      style={{
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <GraphExplorer
        idolList={idolList}
        accompaniments={normalized.accompaniments}
        idols={normalized.idols}
        idfMap={idfMap}
        pmiMap={pmiMap}
        cooccurrenceCompanionPairs={cooccurrenceCompanionPairs}
        similarByAccompanimentPairs={similarByAccompanimentPairs}
      />
    </div>,
    { title: `グラフ探索 - ${SITE_TITLE}` }
  );
});

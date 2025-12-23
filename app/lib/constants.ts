import type { Brand } from "@/types";

export const SITE_TITLE = "アイドルマスター アイドル名鑑 共起関係可視化";

export const BRAND_COLORS: Record<Brand, string> = {
  imas: "#f34f6d",
  deremas: "#2681c8",
  milimas: "#ffc30b",
  sidem: "#0fbe94",
  shiny: "#8dbbff",
  gakuen: "#f39800",
};

export const BRAND_NAMES: Record<Brand, string> = {
  imas: "765PRO",
  deremas: "シンデレラ",
  milimas: "ミリオン",
  sidem: "SideM",
  shiny: "シャニマス",
  gakuen: "学マス",
};

export const ALL_BRANDS: Brand[] = ["imas", "deremas", "milimas", "sidem", "shiny", "gakuen"];

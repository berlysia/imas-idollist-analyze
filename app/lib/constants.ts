import type { Brand } from "@/types";

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
  shiny: "シャイニー",
  gakuen: "学マス",
};

export const ALL_BRANDS: Brand[] = ["imas", "deremas", "milimas", "sidem", "shiny", "gakuen"];

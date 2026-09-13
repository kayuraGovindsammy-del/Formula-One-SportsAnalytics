export const DRIVER_IMAGES: Record<string, string> = {
  ALB: "/drivers/Albon.png",
  ALO: "/drivers/Alonso.png",
  ANT: "/drivers/Antonelli.png",
  BEA: "/drivers/Bearman.png",
  BOR: "/drivers/Bortoleto.png",
  COL: "/drivers/Colapinto.webp",
  GAS: "/drivers/Gasly.png",
  HAD: "/drivers/Hadjar.png",
  HAM: "/drivers/Hamilton.png",
  HUL: "/drivers/Hulkenberg.png",
  LAW: "/drivers/Lawson.webp",
  LEC: "/drivers/Leclerc.png",
  NOR: "/drivers/Norris.jpg",
  OCO: "/drivers/Ocon.png",
  PIA: "/drivers/Piastri.jpg",
  RUS: "/drivers/Russel.png",
  SAI: "/drivers/Sainz.jpg",
  STR: "/drivers/Stroll.png",
  TSU: "/drivers/Tsunoda.webp",
  VER: "/drivers/Verstappen.jpg",
  DOO: "/drivers/Doohan.webp",
};

export function getDriverImage(driverId: string): string {
  return DRIVER_IMAGES[driverId] ?? "/drivers/default-driver.png";
}
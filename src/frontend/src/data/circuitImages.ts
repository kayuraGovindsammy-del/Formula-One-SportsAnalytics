export const CIRCUIT_IMAGES: Record<string, string> = {
  australia: "/circuits/Australia.svg",
  china: "/circuits/China.svg",
  japan: "/circuits/Japan.svg",
  bahrain: "/circuits/Bahrain.svg",
  "saudi arabia": "/circuits/Saudi.svg",
  saudi: "/circuits/Saudi.svg",
  miami: "/circuits/Miami.svg",
  imola: "/circuits/Imola.svg",
  monaco: "/circuits/Monaco.svg",
  spain: "/circuits/Spanish.svg",
  canada: "/circuits/Montreal.svg",
  austria: "/circuits/Austria.svg",

  // Silverstone
  britain: "/circuits/Silverstone.svg",
  "united kingdom": "/circuits/Silverstone.svg",
  uk: "/circuits/Silverstone.svg",
  england: "/circuits/Silverstone.svg",

  belgium: "/circuits/Belgium.svg",
  hungary: "/circuits/Hungary.svg",
  netherlands: "/circuits/Dutch.svg",
  italy: "/circuits/Monza.svg",
  azerbaijan: "/circuits/Baku.svg",
  singapore: "/circuits/Singapore.svg",

  // Austin
  usa: "/circuits/Austin.svg",
  "united states": "/circuits/Austin.svg",

  mexico: "/circuits/Mexico.svg",
  brazil: "/circuits/Brazil.svg",
  "las vegas": "/circuits/Las vegas.svg",
  qatar: "/circuits/Qatar.svg",

  // Abu Dhabi
  "abu dhabi": "/circuits/Abu Dhabi.svg",
  "united arab emirates": "/circuits/Abu Dhabi.svg",
  uae: "/circuits/Abu Dhabi.svg",
};

export function getCircuitImage(country: string): string {
  const key = country.trim().toLowerCase();

  return CIRCUIT_IMAGES[key] ?? "";
}
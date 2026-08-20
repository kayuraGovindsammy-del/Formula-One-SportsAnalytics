// ---------------------------------------------------------------------------
// SPRINT 1 PLACEHOLDER — hardcoded constructor names.
//
// data/sample/drivers.json carries only `constructor_id`; there is no
// constructors.json. This map is the backend's copy of the same lookup the
// frontend currently hardcodes in src/frontend/src/data/constructors.ts.
//
// It is replaced by a SELECT against the `constructors` table in
// database/schema.sql. The function signature below is the contract that must
// survive that swap.
// ---------------------------------------------------------------------------

const CONSTRUCTOR_NAMES: Readonly<Record<string, string>> = {
  RBR: "Red Bull Racing",
  MCL: "McLaren",
  FER: "Ferrari",
  MER: "Mercedes",
  AMR: "Aston Martin",
  WIL: "Williams",
  RB: "Racing Bulls",
  HAA: "Haas F1 Team",
  ALP: "Alpine",
  SAU: "Kick Sauber",
};

/**
 * Resolves a constructor's display name, per docs/api-design.md §4.1. Falls
 * back to the id itself for an unknown code rather than throwing — an unmapped
 * team shouldn't take down the drivers endpoint.
 */
export function getConstructorName(constructorId: string): string {
  return CONSTRUCTOR_NAMES[constructorId] ?? constructorId;
}

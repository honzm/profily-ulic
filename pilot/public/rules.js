// Width rules for a street design, after IPR Praha: Manuál tvorby veřejných prostranství, kap. C.2
// (text in data/zdroje/ipr_manual_C2.txt). "min": below the minimum the manual allows;
// "zaklad": narrower than the manual's basic (recommended) width.
import { TYPES } from "./types.js";

const fmt = (v) => `${v.toFixed(2).replace(".", ",")} m`;

// A driving lane by the class of the street (Prague: TSK's class, derive.js classGroup, as the functional group of
// ČSN 73 6110; Bára 10. 11. 2026). ČSN 73 6110 (after ČVUT FD): group A 3.50 m, B 3.00–3.25 m, C 2.75–3.00 m;
// Manuál C.2: a basic lane 3.00 m in important streets, 2 × 2.75 m (2 × 2.50 m at low volumes) in calm streets.
// Zákon 13/1997 Sb. § 6 and its decree: MK I is a rapid or a collector road (A or B), MK II a collector or service
// road; TSK does not say which, so MK I and II take group B and only motorways group A.
const GROUP = { dalnice: "A", mk1: "B", mk2: "B", sil1: "B", sil2: "B", mk3: "C", sil3: "C", mk4: "D" };
const LANE_BY_GROUP = {
  A: { min: 3, zaklad: 3.5, why: "jízdní pruh dálnice: ČSN 73 6110 skupina A 3,5 m" },
  B: { min: 3, zaklad: 3, why: "jízdní pruh sběrné komunikace MK I nebo II: ČSN 73 6110 skupina B 3–3,25 m, Manuál C.2 základ 3 m" },
  C: { min: 2.75, zaklad: 3, why: "jízdní pruh obslužné komunikace MK III: ČSN 73 6110 skupina C 2,75–3 m" },
  D: { min: 2.5, zaklad: 2.75, why: "jízdní pruh zklidněné komunikace MK IV: Manuál C.2 2,75 m, při nízkých intenzitách 2,5 m" },
};
const laneByClass = (cls) => LANE_BY_GROUP[GROUP[cls]];

// Width a part should have: [minimum, basic], or null when the manual gives none for it.
function limits(s, segs, i) {
  const parking = [segs[i - 1], segs[i + 1]].find((x) => x?.type === "parkovani");
  switch (s.type) {
    case "chodnik": case "chodnik_kola": case "stezka_sdilena":
      // Minimum narrowed sidewalk 1.5 m (1.2 m in exceptions), basic 2–2.5 m. Beside cars parked on it (OSM
      // on_kerb / half_on_kerb) the same holds for what the cars leave free.
      if (parking?.position) return { min: 1.5, zaklad: 2, why: `zbytek chodníku vedle stání ${parking.position === "on_kerb" ? "na chodníku" : "napůl na chodníku"}: zúžený chodník min. 1,5 m, základ 2–2,5 m` };
      return { min: 1.5, zaklad: 2, why: "chodník: zúžený min. 1,5 m, základ 2–2,5 m" };
    case "pruh": case "pruh_piktokoridor":
      return laneByClass(s.roadClass ?? segs.find((x) => x.roadClass)?.roadClass) || { min: 2.5, zaklad: 3, why: "jízdní pruh: základ 3 m, ve zklidněné ulici 2,5 m" };
    case "bus": case "bus_cyklo":
      return s.type === "bus_cyklo"
        ? { min: 4.25, zaklad: 4.25, why: "pruh pro autobus a cyklisty: 4,25–4,5 m" }
        : { min: 3, zaklad: 3.25, why: "pruh pro autobusy: 3,25 m" };
    case "cyklopruh": case "ochranny_pruh": {
      if (parking) {
        const perp = parking.orient === "kolme" || parking.orient === "sikme";
        return perp
          ? { min: 2, zaklad: 2, why: "cyklopruh vedle kolmého nebo šikmého stání: min. 2 m" }
          : { min: 1.75, zaklad: 1.75, why: "cyklopruh vedle podélného stání: min. 1,75 m" };
      }
      return s.type === "ochranny_pruh"
        ? { min: 1.25, zaklad: 1.5, why: "ochranný cyklopruh: základ 1,5 m, nejméně 1,25 m" }
        : { min: 1.5, zaklad: 1.5, why: "cyklopruh u obruby: 1,5 m" };
    }
    case "parkovani":
      return s.orient === "kolme" || s.orient === "sikme"
        ? { min: 4.5, zaklad: 5, why: "kolmé a šikmé stání: 5 m (4,5 m s přesahem nad chodník)" }
        : { min: 2, zaklad: 2, why: "podélné stání: 2 m" };
    default:
      return null;
  }
}

// Tram parts that make a belt of their own: the reserved tram lane and the separate tram bed (not the tram in a
// lane with cars).
const BELT = new Set(["tramvaj_pruh", "tramvaj"]);

// [{i, level, text}] for the parts of a profile that break the rules.
export function checkRules(profile) {
  const segs = profile.segments;
  const out = [];
  segs.forEach((s, i) => {
    const l = limits(s, segs, i);
    if (!l) return;
    const label = TYPES[s.type]?.label || s.type;
    if (s.width < l.min - 0.005) out.push({ i, level: "min", text: `${label} ${fmt(s.width)} je pod minimem (${l.why}).` });
    else if (s.width < l.zaklad - 0.005) out.push({ i, level: "zaklad", text: `${label} ${fmt(s.width)} je užší než základ (${l.why}).` });
    if (typeof s.bikeDir === "string" && typeof s.dir === "string" && s.bikeDir !== s.dir) {
      const min = ["cyklopruh", "ochranny_pruh"].includes(s.type) ? (s.type === "ochranny_pruh" ? 1.25 : 1.5) : 3;
      const why = ["cyklopruh", "ochranny_pruh"].includes(s.type)
        ? "TP 179 pro cyklistický protisměr v cyklopruhu"
        : "TP 179 pro cyklisty v protisměru jednosměrky";
      if (s.width < min - 0.005) out.push({ i, level: "min", text: `${label} ${fmt(s.width)} je užší než minimum ${fmt(min)} pro cyklisty v protisměru (${why}).` });
    }
  });
  // A tram belt (adjacent tram parts) of two tracks, a reserved tram lane or a separate bed, needs 6.5 m at
  // least, 7 m as the standard and 8 m with the overhead-line poles between the tracks (Manuál C.2; Bára:
  // 6.5–7 m without poles is orange).
  for (let i = 0; i < segs.length; i++) {
    if (!TYPES[segs[i].type]?.tracks) continue;
    let j = i, w = 0;
    while (j < segs.length && TYPES[segs[j].type]?.tracks) w += segs[j++].width;
    const belt = segs.slice(i, j);
    if (j - i >= 2 && belt.every((x) => BELT.has(x.type))) {
      const poles = belt.some((x) => x.items?.some((it) => it.kind === "sloup_trakce"));
      if (w < 6.5 - 0.005) out.push({ i, level: "min", text: `Tramvajový pás ${fmt(w)} je užší než minimum 6,5 m pro dvě koleje.` });
      else if (poles && w < 8 - 0.005) out.push({ i, level: "zaklad", text: `Tramvajový pás se sloupy trakčního vedení ${fmt(w)} je užší než 8 m (Manuál C.2).` });
      else if (!poles && w < 7 - 0.005) out.push({ i, level: "zaklad", text: `Tramvajový pás ${fmt(w)} je užší než standard 7 m (Manuál C.2).` });
    }
    i = j - 1;
  }
  return out;
}

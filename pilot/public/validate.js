// Checks a saved profile (from the browser's storage or a JSON file) before the app uses it: a broken
// or edited file must not break the drawing. Unknown types and items are made harmless, numbers
// that the drawing needs must be numbers, a part without a usable width is an error.
import { TYPES, SOURCES, ITEMS, PARKING_USE, PARKING_POSITION, TRAM_BEDS } from "./types.js";
import { SIGNS, PLATES, MAX_PER_PART } from "./signs.js";

const EDGE_KINDS = new Set(["budova", "stavba", "zahrada", "zelen", "voda", "parkoviste", "plot", "volno"]);
const EDGE_STYLES = new Set(["sikma", "funkce", "moderni", "plocha", "nizky", "hala", "centrum", "centrum-obchod", "sidliste", "sidliste-lodzie", "rd"]);

const num = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
// Building facts at the edges that end up in SVG attributes (heights, floors, area).
const INFO_NUMBERS = ["height", "levels", "cornice", "roof", "roofType", "iprKind", "area", "km", "period", "built", "panel", "house", "tint"];

export function cleanProfile(p, what = "profil") {
  if (!Array.isArray(p?.segments) || !p.segments.length) throw new Error(`${what}: chybí části profilu`);
  for (const s of p.segments) {
    if (typeof s !== "object" || !s) throw new Error(`${what}: vadná část`);
    if (!(s.type in TYPES)) s.type = "nezname";
    if (!num(s.width, 0.01, 200)) throw new Error(`${what}: vadná šířka části`);
    if (s.source && !(s.source in SOURCES)) s.source = "user";
    // Values the drawing reads as words: anything else is dropped.
    for (const k of ["dir", "bikeDir"]) if (k in s && !["forward", "backward"].includes(s[k])) delete s[k];
    if ("orient" in s && !["podelne", "sikme", "kolme"].includes(s.orient)) delete s.orient;
    if ("use" in s && !(s.use in PARKING_USE)) delete s.use;
    if ("position" in s && !(s.type === "parkovani" && Object.hasOwn(PARKING_POSITION, s.position))) delete s.position;
    if ("turn" in s && typeof s.turn !== "string") delete s.turn;
    for (const k of ["trolley", "wires"]) if (k in s && s[k] !== true) delete s[k];
    // A profile saved before the three kinds of tram (11/2026) has no bed on its tram belt: panels.
    if ("bed" in s && !(s.bed in TRAM_BEDS)) delete s.bed;
    for (const k of ["withBus", "bedGuess"]) if (k in s && s[k] !== true) delete s[k];
    if ("roadClass" in s && !/^(dalnice|mk[1-4]|sil[1-3])$/.test(s.roadClass)) delete s.roadClass;
    if ("signs" in s) {
      s.signs = cleanSigns(s.signs).slice(0, MAX_PER_PART);
      if (s.signs.some((x) => x.k === "ip4c") && s.dir && !s.bikeDir) s.bikeDir = s.dir === "forward" ? "backward" : "forward";
    }
    if (s.signs && !s.signs.length) delete s.signs;
    s.items = Array.isArray(s.items) ? s.items.filter((it) => it && it.kind in ITEMS && num(it.f, 0, 1)) : [];
  }
  delete p.zones; // signs for the whole profile were dropped (Bára 10. 11. 2026)
  p.edges = typeof p.edges === "object" && p.edges ? p.edges : {};
  for (const side of ["left", "right"]) {
    if (side in p.edges && !EDGE_KINDS.has(p.edges[side])) p.edges[side] = "volno";
    if (`${side}Style` in p.edges && !EDGE_STYLES.has(p.edges[`${side}Style`])) delete p.edges[`${side}Style`];
  }
  for (const side of ["leftInfo", "rightInfo"]) {
    const info = p.edges[side];
    if (!info || typeof info !== "object") { delete p.edges[side]; continue; }
    for (const k of INFO_NUMBERS) if (k in info && !num(info[k], 0, 100000)) delete info[k];
    // The block's shape (derive.js blockShape) decides panel house or tenement: all four numbers or none.
    const b = info.block;
    if (b !== undefined && !(b && ["length", "width", "fill", "parts"].every((k) => num(b[k], 0, 100000)))) delete info.block;
  }
  return p;
}

// Traffic signs (signs.js): known keys, a speed as a number, a known plate, a direction word.
function cleanSigns(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((x) => x && (Object.hasOwn(SIGNS, x.k) || (x.k === "oneway" && x.plate === "protismer") || (x.k === "ip4c"))).map((x) => {
    const contra = x.k === "ip4c" || (x.k === "oneway" && x.plate === "protismer");
    const normalized = contra ? { k: "ip4c" } : { k: x.k };
    return { ...normalized,
      ...(num(x.v, 1, 200) ? { v: x.v } : {}),
      ...(!contra && Object.hasOwn(PLATES, x.plate) ? { plate: x.plate } : {}),
      ...(["forward", "backward"].includes(x.dir) ? { dir: x.dir } : {}),
    };
  }).slice(0, 12);
}

// Position of the cut: numbers in and around the Czech Republic, reach of each side 1–70 m; else no cut.
export function cleanCut(c) {
  if (!c || !num(c.lat, 48, 52) || !num(c.lon, 12, 19) || !num(c.bearing, -360, 360)) return null;
  const reach = c.reach && num(c.reach.left, 1, 70) && num(c.reach.right, 1, 70) ? { left: c.reach.left, right: c.reach.right } : undefined;
  const span = c.span && num(c.span.left, 0, 70) && num(c.span.right, 0, 70) ? { left: c.span.left, right: c.span.right } : undefined;
  // What the export credits (app.js, city.js creditLines): a region's name and two flags, nothing else.
  const src = c.sources || {};
  const sources = { ...(typeof src.region === "string" && src.region && { region: src.region.slice(0, 80) }), ...(src.dmvs === true && { dmvs: true }), ...(src.ortho === true && { ortho: true }) };
  return { ...c, name: String(c.name || "Ulice"), note: typeof c.note === "string" ? c.note : "", reach, span, sources };
}

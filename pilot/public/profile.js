// SVG drawing and direct editing of a street profile. Drawing units are centimetres,
// matching the Streetmix illustrations (1 px = 1 cm).
import { TYPES, SOURCES, PARKING_USE, PARKING_POSITION, TRAM_BEDS } from "./types.js";
import { city, cityById, CITY_IDS, creditLines } from "./city.js";
import { SIGNS, PLATES, signFile, plateFile, signLabel } from "./signs.js";

const NS = "http://www.w3.org/2000/svg";
const GROUND = 760; // roadway surface
const SIGN_SIZE = 125; // traffic signs under the labels in an export: width of a basic sign (cm)
const CURB = 15;
const EDGE = 400; // width drawn for the building / open edge
const FLOOR = 3.5; // typical floor height for estimating floors from a building's height (m)
const H = 1000;

const SPRITE_FILES = [
  "car-inbound", "car-outbound", "streetcar-inbound", "streetcar-outbound", "bus-inbound", "bus-outbound",
  "biker-01-inbound", "biker-01-outbound", "people-01", "people-05", "people-12", "people-20", "people-27",
  "tree", "bush",
  "car-sideways-left", "car-sideways-right", "car-angled-front-left", "car-angled-front-right",
  "bench-center", "cafe-seating-occupied", "bike-rack-perpendicular-left", "bikeshare-left",
  "transit-shelter-01-left", "transit-shelter-01-right", "bollard", "planter-box", "guardrail",
  "lamp-modern-left", "lamp-modern-right",
];
const PEOPLE = ["people-01", "people-05", "people-12", "people-20", "people-27"];
// Prague illustrations (praha/) standing in for Streetmix ones; the rest stays Streetmix.
const PRAHA = {
  "streetcar-inbound": "t3-inbound", "streetcar-outbound": "t3-outbound", "bus-inbound": "bus-inbound", "bus-outbound": "bus-outbound",
  "lamp-modern-left": "lamp-left", "lamp-modern-right": "lamp-right", "bench-center": "bench-center",
  "bike-rack-perpendicular-left": "bike-rack", "bollard": "bollard",
  "transit-shelter-01-left": "transit-shelter-left", "transit-shelter-01-right": "transit-shelter-right",
  "transit-shelter-tram-left": "transit-shelter-tram-left", "transit-shelter-tram-right": "transit-shelter-tram-right",
  "tram-pole-left": "sloup-trakce-left", "tram-pole-right": "sloup-trakce-right",
  "tram-pole-lamp-left": "sloup-trakce-lampa-left", "tram-pole-lamp-right": "sloup-trakce-lampa-right",
  "stop-post-left": "oznacnik-left", "stop-post-right": "oznacnik-right",
  "stop-post-tram-left": "oznacnik-tram-left", "stop-post-tram-right": "oznacnik-tram-right",
};
// Brno illustrations (brno/): the tram Tatra T3 in DPMB colours (Bára: the nicest; 45T and 13T drawn too) and bus, and furniture after the
// rules of Brno's city architect (KAM, Principy tvorby veřejných prostranství, kap. 9): anthracite steel,
// wooden slats, a slim glass stop shelter, a stainless bike rack. Houses are drawn as in Prague.
const BRNO = {
  "streetcar-inbound": "t3-inbound", "streetcar-outbound": "t3-outbound", "bus-inbound": "bus-inbound", "bus-outbound": "bus-outbound",
  "lamp-modern-left": "lamp-left", "lamp-modern-right": "lamp-right", "bench-center": "bench-center",
  "bike-rack-perpendicular-left": "bike-rack", "bollard": "bollard",
  "transit-shelter-01-left": "transit-shelter-left", "transit-shelter-01-right": "transit-shelter-right",
  "transit-shelter-tram-left": "transit-shelter-tram-left", "transit-shelter-tram-right": "transit-shelter-tram-right",
  "tram-pole-left": "sloup-trakce-left", "tram-pole-right": "sloup-trakce-right",
  "tram-pole-lamp-left": "sloup-trakce-lampa-left", "tram-pole-lamp-right": "sloup-trakce-lampa-right",
  "stop-post-left": "oznacnik-left", "stop-post-right": "oznacnik-right",
  "stop-post-tram-left": "oznacnik-tram-left", "stop-post-tram-right": "oznacnik-tram-right",
};
// Every other city brings its own map of illustrations (city.js artMap, files in pilot/public/<art>/).
const CITY_ART = { praha: PRAHA, brno: BRNO };
for (const id of CITY_IDS) { const c = cityById(id); if (c.artMap) CITY_ART[c.art] = c.artMap; }
// The illustrations of the current cut's city, or Streetmix's (the switch "Ilustrace" off).
let artOn = true;
const artKey = () => (artOn ? city.art : "streetmix");
const cityArt = () => artOn && !!CITY_ART[city.art]; // the city's own set
// The credit lines of an export or a saved file for the current city and art (src: the cut's sources, app.js).
export const exportCredits = (src) => creditLines(city, src || {}, cityArt());
// Prague buildings are drawn from the side (we look along the street): the outline tells the type.
export const BUILDING_STYLES = { sikma: "dům se šikmou střechou", funkce: "funkcionalistický činžák", moderni: "moderní bytový dům", plocha: "panelový dům", nizky: "nízký dům", hala: "hala" };
const OLD_STYLES = { centrum: "sikma", "centrum-obchod": "sikma", sidliste: "plocha", "sidliste-lodzie": "plocha", rd: "nizky" };
const HOUSE_TYPES = new Set(["house", "detached", "semidetached_house", "terrace", "bungalow", "villa", "farm", "garage", "garages", "shed"]);
const HALL_TYPES = new Set(["retail", "supermarket", "industrial", "manufacture", "warehouse", "hangar", "sports_hall", "service", "commercial_hall"]);
const HALL_AREA = 1200; // m²: a footprint this big on up to 3 floors reads as a hall
const FLAT_RESIDENTIAL = new Set(["apartments", "residential", "dormitory"]); // flat-roofed homes get balconies
// IPR "Podlažnosti" roof shape (domain URK_STRECHA): 1 pitched, 3 flat, 4 atypical (mix), 5 dome, 99 unknown.
const IPR_ROOF = { 1: "sikma", 3: "plocha", 5: "sikma" };
// Within innerKm of the centre an unknown building is taken for a pitched-roof tenement, from estateKm
// for a panel house; a town has its own (city.js innerKm, estateKm; Most has no old inner town).
const innerKm = () => city.innerKm ?? 3;
const STOREY = { sikma: 360, funkce: 310, moderni: 300, plocha: 280, nizky: 300, hala: 700 }; // typical storey (cm); a hall is one tall storey
const DEFAULT_FLOORS = { sikma: 5, funkce: 6, moderni: 6, plocha: 8, nizky: 1, hala: 1 };
const PITCH = Math.tan((40 * Math.PI) / 180);
const RIDGE = 260; // ridge of a family house, from its street facade (cm)
// Side windows: width and gap (cm), sill and height as a share of the storey.
const WINDOWS = { sikma: { w: 85, gap: 60, sill: 0.24, h: 0.56 }, plocha: { w: 120, gap: 50, sill: 0.3, h: 0.45 },
  nizky: { w: 85, gap: 70, sill: 0.3, h: 0.45 }, funkce: { w: 110, gap: 60, sill: 0.3, h: 0.5 }, moderni: { w: 120, gap: 40, sill: 0.05, h: 0.8 }, hala: {} };
// Streetmix-like colours: saturated pastel walls, dark glass with a diagonal glint, cream frames.
const PALETTES = {
  sikma: ["#e7b96a", "#d99a86", "#8fb79a", "#86a9c6", "#e0c98f"],
  // Panel houses: quiet colours (sand, warm grey, grey-blue, muted terracotta), the wall a lighter shade.
  plocha: ["#d2bd97", "#c5bcb0", "#aab6bd", "#c4ab9a"],
  plochaWall: ["#e6dcc4", "#d6e2e6", "#ecd5c7", "#dfe6cf"],
  nizky: ["#efd29a", "#ece4d2", "#e6bfa9"],
  // Functionalist tenements: light smooth plaster (cream, warm white, pale ochre, pale grey).
  funkce: ["#efe6d2", "#ebe7de", "#e8d9bb", "#dfe1dc", "#e6cf9f", "#d3d8cc"],
  // New-built flats: white or light grey render; the accent is anthracite or larch cladding.
  moderni: ["#f2f1ee", "#e4e4e1", "#ecebe6", "#d9dbdc"],
  hala: ["#e0574f", "#3f88c5", "#4caf7d"],
};
const ROOF = { tile: "#c25a3c", tileDark: "#8f3f2b", slate: "#4f5d6b", slateDark: "#36414c" };
const BRICK = "#b8644a", SKLEP = "#8e8a82";
const GLASS = "#2f3557", GLINT = "#454a75", LIT = "#f4d98c", FRAME = "#f6efdf", DOOR = "#7a4f3a", STONE = "#b9ab8f";
export const OFFICE_TYPES = new Set(["office", "commercial", "civic", "government", "public", "school", "university", "hospital", "hotel"]);
const TALL_SHARE = 0.45; // the most of the view's width a building may rise above the ground
let labelTop = -Infinity; // building labels stay below this y (set per drawing in buildSvg)
const sprites = {};
export const setArt = (on) => { artOn = on; };
export const getArt = () => artOn;

// A missing or broken illustration is left out of the drawing instead of stopping the app.
async function loadSprite(key, path) {
  try {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`${r.status}`);
    const text = await r.text();
    const vb = text.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
    if (!vb) throw new Error("bez viewBox");
    const uri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(text);
    sprites[key] = { uri, w: vb[2], h: vb[3] };
  } catch (err) {
    console.warn("ilustrace chybí", path, err.message);
  }
}

// Streetmix's sprites once, a city's own set when a cut first lands in it.
const loadedArt = new Set();
export async function loadSprites() {
  const sets = [];
  if (!loadedArt.has("streetmix")) { loadedArt.add("streetmix"); sets.push(...SPRITE_FILES.map((name) => loadSprite(name, `streetmix/${name}.svg`))); }
  const a = city.art;
  if (CITY_ART[a] && !loadedArt.has(a)) { loadedArt.add(a); sets.push(...[...new Set(Object.values(CITY_ART[a]))].map((file) => loadSprite(`${a}/${file}`, `${a}/${file}.svg`))); }
  await Promise.all(sets);
}

const el = (name, attrs = {}, parent) => {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

const fmt = (m) => m.toFixed(2).replace(".", ",") + " m";
export const totalWidth = (p) => p.segments.reduce((a, s) => a + s.width, 0);

const TURNS = { left: "vlevo", slight_left: "mírně vlevo", sharp_left: "ostře vlevo", through: "rovně", right: "vpravo",
  slight_right: "mírně vpravo", sharp_right: "ostře vpravo", reverse: "otočení", merge_to_left: "připojení", merge_to_right: "připojení" };
// Street furniture and barriers standing at x on a surface at height top.
// The surface of a separate tram bed, raised behind curbs (Bára): concrete panels with their joints, gravel
// with the sleepers showing, grass, or asphalt like the roadway (beds used by buses). A curb stone at each end where the bed meets another part.
function drawTramBed(g, s, x, w, top, bedBefore, bedAfter) {
  const kind = TRAM_BEDS[s.bed] ? s.bed : "panely";
  el("rect", { x, y: top, width: w, height: 14, fill: TRAM_BEDS[kind].color }, g);
  if (kind === "panely") {
    for (let u = x + 60; u < x + w - 20; u += 120) el("rect", { x: u, y: top, width: 2, height: 14, fill: "#8d887c" }, g);
  } else if (kind === "strk") {
    for (let u = x + 8; u < x + w - 4; u += 14) el("circle", { cx: u, cy: top + 4 + ((u / 14) % 2) * 5, r: 2.5, fill: "#6f6a61" }, g);
    for (let u = x + 30; u < x + w - 30; u += 60) el("rect", { x: u, y: top - 2, width: 26, height: 5, fill: "#5d5247" }, g);
  } else if (kind === "trava") {
    for (let u = x + 5; u < x + w - 3; u += 9) el("path", { d: `M${u} ${top + 2} l3 -9 l3 9`, fill: "#5f9e3a" }, g);
  }
  const curb = (cx) => el("rect", { x: cx, y: top, width: 12, height: CURB + 8, fill: "#c9c5ba", stroke: "#8d887c", "stroke-width": 1 }, g);
  if (!bedBefore) curb(x);
  if (!bedAfter) curb(x + w - 12);
}

const POLE_SCALE = 0.93; // overhead-line poles: their contact wire (5.9 m in the picture) at WIRE_H
function drawItem(g, it, x, top, right) {
  const line = (attrs) => el("rect", attrs, g);
  switch (it.kind) {
    // The lamp's arm reaches over the street: on the right half the arm points left. Its foot (not
    // the middle of the picture) stands at x: x = 348 in the "left" picture, 22 in the "right" one.
    case "lampa": return sprite(g, right ? "lamp-modern-left" : "lamp-modern-right", x, top, false, right ? 348 : 22);
    // The Prague bench has its back on the left: on the right half it turns to face the street too.
    case "lavicka": return sprite(g, "bench-center", x, top, right);
    case "strom": return sprite(g, "tree", x, top);
    case "stojan_kola": return sprite(g, "bike-rack-perpendicular-left", x, top);
    case "sdilena_kola": return sprite(g, "bikeshare-left", x, top);
    case "pristresek": {
      const side = right ? "right" : "left";
      // A tram stop's own shelter where the city has one (Prague, Brno), else the bus stop's.
      return sprite(g, it.tram && ownSprite(`transit-shelter-tram-${side}`) ? `transit-shelter-tram-${side}` : `transit-shelter-01-${side}`, x, top);
    }
    case "sloupek": return sprite(g, "bollard", x, top);
    // Tram overhead-line pole (technical map): a 9 m steel pole with its bracket over the tracks; a street
    // lamp mounted on it (OSM) is drawn with it.
    case "sloup_trakce": {
      // The city's own pole (praha/sloup-trakce-*): its bracket over the tracks, on the right half pointing left;
      // a pole between the tracks (it.center) carries brackets over both (Bára's photo, Prague).
      const lamp = it.lamp ? "-lamp" : "";
      if (ownSprite(`tram-pole${lamp}-left`)) {
        // Scaled so the wire hangs at WIRE_H, where the trams' pantographs and the trolleybuses' poles reach.
        // A pole between the tracks reaches with each bracket to the middle of its track (it.reach, cm; the picture's
        // wire hangs 290 cm from the pole).
        const sx = it.reach ? it.reach / 290 : POLE_SCALE;
        const pg = el("g", { transform: `translate(${x} ${top}) scale(${sx} ${POLE_SCALE}) translate(${-x} ${-top})` }, g);
        if (it.center || !right) sprite(pg, `tram-pole${lamp}-right`, x, top, false, 22);
        if (it.center || right) sprite(pg, `tram-pole${lamp}-left`, x, top, false, 348);
        return;
      }
      if (it.lamp) sprite(g, right ? "lamp-modern-left" : "lamp-modern-right", x, top, false, right ? 348 : 22);
      const arm = right ? -1 : 1;
      el("path", { d: `M ${x - 14} ${top} L ${x - 9} ${top - 900} L ${x + 9} ${top - 900} L ${x + 14} ${top} Z`, fill: "#5b6460" }, g);
      line({ x: Math.min(x, x + arm * 260), y: top - 830, width: 260, height: 7, fill: "#5b6460" });
      el("line", { x1: x, y1: top - 760, x2: x + arm * 260, y2: top - 826, stroke: "#5b6460", "stroke-width": 4 }, g);
      return;
    }
    // Stop pole (označník zastávky, technical map).
    case "oznacnik":
      if (ownSprite("stop-post-left")) return sprite(g, `stop-post${it.tram ? "-tram" : ""}-${right ? "right" : "left"}`, x, top);
      line({ x: x - 4, y: top - 280, width: 8, height: 280, fill: "#3d3b36" });
      line({ x: x - 26, y: top - 300, width: 52, height: 64, fill: "#fff", stroke: "#b5302a", "stroke-width": 5 });
      el("text", { x, y: top - 256, "text-anchor": "middle", "font-size": 30, "font-weight": "bold", fill: "#1f1f1d" }, g).textContent = "Z";
      return;
    case "kvetinac": return sprite(g, "planter-box", x, top);
    case "svodidlo": return sprite(g, "guardrail", x, top);
    case "zahradka": return sprite(g, "cafe-seating-occupied", x, top);
    case "zivy_plot": return sprite(g, "bush", x, top);
    case "plot":
      line({ x: x - 4, y: top - 150, width: 8, height: 150, fill: "#6b6a65" });
      for (let k = 0; k < 3; k++) line({ x: x - 30, y: top - 140 + k * 45, width: 60, height: 5, fill: "#6b6a65" });
      return;
    case "zabradli":
      line({ x: x - 3, y: top - 100, width: 6, height: 100, fill: "#55534d" });
      line({ x: x - 40, y: top - 100, width: 80, height: 6, fill: "#55534d" });
      return;
    case "oporna_zed":
      line({ x: x - 15, y: top - 120, width: 30, height: 120, fill: "#a39e92" });
      return;
    case "rozcestnik":
      line({ x: x - 4, y: top - 230, width: 8, height: 230, fill: "#3d3b36" });
      line({ x: x - 40, y: top - 240, width: 80, height: 60, fill: "#2f5f8f" });
      return;
    case "taxi":
      line({ x: x - 4, y: top - 230, width: 8, height: 230, fill: "#3d3b36" });
      line({ x: x - 45, y: top - 250, width: 90, height: 45, fill: "#e8c23a" });
      el("text", { x, y: top - 218, "text-anchor": "middle", "font-size": 30, fill: "#1f1f1d" }, g).textContent = "TAXI";
      return;
    case "svah":
      el("path", { d: `M ${x - 40} ${top} L ${x} ${top - 40} L ${x + 40} ${top} Z`, fill: "#9b7f5f", opacity: 0.6 }, g);
      return;
  }
}

// Direction of the nearest driving lane, so parked cars face the traffic next to them.
function laneDir(segs, i) {
  for (let d = 1; d < segs.length; d++) {
    for (const j of [i - d, i + d]) {
      if (["pruh", "pruh_piktokoridor", "bus", "bus_cyklo", "tramvaj_v_pruhu"].includes(segs[j]?.type)) return segs[j].dir || "forward";
    }
  }
  return "forward";
}

export const ORIENT_LABEL = { podelne: "podélné", sikme: "šikmé", kolme: "kolmé" };
const CAR_TRACK = 170; // wheel to wheel of the parked car's sprite (cm), for its tilt across the kerb
const KERB_PAVING = "#c4c0b4"; // the sidewalk's paving under parked cars, a shade darker than the sidewalk
// On the curb: raised types, and cars parked fully on the sidewalk.
const isRaised = (s) => !!s && (!!TYPES[s.type]?.raised || (s.type === "parkovani" && s.position === "on_kerb"));
export const turnLabel = (v) => v.split(";").map((x) => TURNS[x] || x).join(" + ");

// anchor: the picture's x (its own units) that stands at cx; the middle when not given.
// The most even split of a name into two lines (null for one word).
export function twoLines(text) {
  // A name of two things ("Jízdní pruh ↑, piktokoridor ↓") breaks after the comma.
  const comma = text.indexOf(", ");
  if (comma > 0) return [text.slice(0, comma + 1), text.slice(comma + 2)];
  const words = text.split(" ");
  let best = null;
  for (let j = 1; j < words.length; j++) {
    const a = words.slice(0, j).join(" "), b = words.slice(j).join(" ");
    if (!best || Math.max(a.length, b.length) < Math.max(best[0].length, best[1].length)) best = [a, b];
  }
  return best;
}

// A tram with its pantograph raised to the contact wire (WIRE_H, as the trolleybuses' wires; Bára): the picture is
// drawn up to its roof (PANTO_CUT of the 420 high picture), its own lowered pantograph left out, and the pantograph
// is drawn from the roof to the wire, seen from the front and so symmetric (Bára), 1 px = 1 cm, after photos of the
// trams themselves (scratchpad sberace-1): the head 1.95 m wide with its two contact strips and the horns bent down.
const WIRE_H = 550, PANTO_CUT = 92;
// Trams with the older diamond pantograph (art folder/file, checked on photos): Prague's T3R.P. Brno's T3R.PV and
// T3R.EV carry a single-arm one today (photos of 1560, 1603, 1658), as the low-floor trams do.
const DIAMOND = new Set(["praha/t3-inbound", "praha/t3-outbound"]);
// The frame's paint by city: yellow on the trams of Prague, Brno, Plzeň, Ostrava, Olomouc and Liberec; the Most EVO2
// and Streetmix's streetcar have a dark one.
const PANTO_YELLOW = new Set(["praha", "brno", "plzen", "ostrava", "olomouc", "liberec"]);
let clipN = 0;
function tramSprite(g, name, cx, bottom) {
  const s = (cityArt() && sprites[`${artKey()}/${CITY_ART[artKey()]?.[name]}`]) || sprites[name];
  if (!s) return;
  const k = s.h / 420, x = cx - s.w / 2, y = bottom - s.h, roof = y + PANTO_CUT * k + 6;
  const head = bottom - WIRE_H, id = `pc${++clipN}`;
  el("rect", { x, y: roof - 8, width: s.w, height: bottom - roof + 8 }, el("clipPath", { id }, el("defs", {}, g)));
  const ink = "#2a2c2e", rise = roof - head, base = roof - 8;
  const yellow = PANTO_YELLOW.has(artKey());
  const col = yellow ? "#e3b324" : "#44474a", edge = yellow ? "#a37f10" : "#1f2123";
  const p = el("g", { stroke: col, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
  const diamond = DIAMOND.has(`${artKey()}/${CITY_ART[artKey()]?.[name] || name}`);
  // The base frame on the roof, on its insulators (four under a diamond, two under a single arm).
  const bw = diamond ? 64 : 40;
  for (const dx of diamond ? [-52, -22, 22, 52] : [-28, 28]) el("rect", { x: cx + dx - 3, y: roof - 13, width: 6, height: 7, rx: 1.5, fill: "#8d8f8c", stroke: "none" }, p);
  el("rect", { x: cx - bw, y: roof - 8, width: 2 * bw, height: 6, rx: 2, fill: ink, stroke: "none" }, p);
  if (diamond) {
    // The diamond (Prague T3R.P) seen from the front is a rectangle (Bára's photos, T3 7232): two upright parallel
    // posts about 1.15 m apart from the base frame to the head, a thin cross between them.
    const w = 58, top = head + 12;
    el("path", { d: `M${cx - w} ${base} V${top} M${cx + w} ${base} V${top}`, "stroke-width": 3 }, p);
    // The cross only in the upper half (Bára).
    const mid = (base + top) / 2;
    el("path", { d: `M${cx - w} ${mid} L${cx + w} ${top} M${cx + w} ${mid} L${cx - w} ${top}`, "stroke-width": 1.5 }, p);
  } else {
    // A single-arm pantograph (Škoda, EVO, Stadler, the modernised T3s): from the front the lower arm is one thick
    // column up to the knee, the upper arm a narrow V opening to the head, with the thin rocker rods crossing it.
    const knee = roof - rise * 0.5;
    el("path", { d: `M${cx - 9} ${base} L${cx - 6} ${knee} H${cx + 6} L${cx + 9} ${base} Z`, fill: col, stroke: edge, "stroke-width": 1 }, p);
    el("rect", { x: cx - 19, y: knee - 4, width: 38, height: 8, rx: 3, fill: col, stroke: edge, "stroke-width": 1 }, p);
    el("path", { d: `M${cx - 15} ${knee} L${cx - 44} ${head + 14} M${cx + 15} ${knee} L${cx + 44} ${head + 14}`, "stroke-width": 4.5 }, p);
    el("path", { d: `M${cx - 36} ${head + 10} L${cx + 12} ${knee - 4} M${cx + 36} ${head + 10} L${cx - 12} ${knee - 4}`, stroke: ink, "stroke-width": 1.2 }, p);
    el("path", { d: `M${cx - 44} ${head + 14} L${cx - 56} ${head + 8} M${cx + 44} ${head + 14} L${cx + 56} ${head + 8}`, stroke: ink, "stroke-width": 2.5 }, p);
  }
  // The head: the bow with its horns bent down (1.95 m wide; the T3's about 1.6 m, its ends bent down a little),
  // the two contact strips on it touching the wire.
  if (diamond) el("path", { d: `M${cx - 82} ${head + 15} L${cx - 76} ${head + 8} H${cx + 76} L${cx + 82} ${head + 15}`, stroke: ink, "stroke-width": 4 }, p);
  else el("path", { d: `M${cx - 97} ${head + 32} Q${cx - 95} ${head + 12} ${cx - 80} ${head + 9} H${cx + 80} Q${cx + 95} ${head + 12} ${cx + 97} ${head + 32}`, stroke: ink, "stroke-width": 4.5 }, p);
  el("rect", { x: cx - 62, y: head, width: 124, height: 3.5, rx: 1, fill: ink, stroke: "none" }, p);
  el("rect", { x: cx - 62, y: head + 5, width: 124, height: 2.5, rx: 1, fill: "#6b6e6a", stroke: "none" }, p);
  el("image", { href: s.uri, width: s.w, height: s.h, x, y, "clip-path": `url(#${id})` }, g);
}

// The current city's own sprite of a name, or undefined (poles and stop posts have no Streetmix stand-in).
const ownSprite = (name) => cityArt() && sprites[`${artKey()}/${CITY_ART[artKey()]?.[name]}`];
function sprite(g, name, cx, bottom, flip = false, anchor = null) {
  const s = (cityArt() && sprites[`${artKey()}/${CITY_ART[artKey()]?.[name]}`]) || sprites[name];
  if (!s) return;
  const img = el("image", { href: s.uri, width: s.w, height: s.h, x: cx - (anchor ?? s.w / 2), y: bottom - s.h }, g);
  if (flip) img.setAttribute("transform", `translate(${2 * cx} 0) scale(-1 1)`);
}

// Building height in metres: tagged in OSM, else from floors (FLOOR per floor).
export function buildingHeight(info) {
  if (!info) return null;
  return info.height || (info.levels ? info.levels * FLOOR : null);
}

// Floors: IPR "Podlažnosti" (cornice + roof floors) or OSM building:levels.
export function buildingLevels(info) {
  if (!info?.levels) return null;
  return { n: info.levels, cornice: info.cornice, roof: info.roof };
}

// Building style: set by hand, else from IPR (roof shape, kind of object, footprint) and the OSM building type.
// Checked on the 100 sample cuts (evaluation/data/budovy3-hodnoceni-*.md).
export function buildingStyle(info, chosen) {
  const set = OLD_STYLES[chosen] || chosen;
  if (BUILDING_STYLES[set]) return set;
  const h = buildingHeight(info);
  const n = info?.levels || (h ? Math.round(h / FLOOR) : null);
  const roof = IPR_ROOF[info?.roofType];
  const cornice = info?.cornice || info?.levels; // a height alone says nothing about floors in a hall
  // Halls: an OSM shop or works building, or a big low footprint, unless IPR says pitched roof on 3+ floors.
  const big = info?.area >= HALL_AREA && !HOUSE_TYPES.has(info?.type);
  if ((HALL_TYPES.has(info?.type) || big || (info?.iprKind === 3 && info?.area >= HALL_AREA / 4)) && !(cornice > 2) && roof !== "sikma") return "hala";
  if (info?.iprKind === 6 || HOUSE_TYPES.has(info?.type) || (n && n <= 2)) return "nizky";
  if (info?.panel) return "plocha"; // RÚIAN: walls of panels
  if (roof) return roof === "plocha" ? flatKind(info, n) : roof;
  // RÚIAN's year the house was completed, where the roof is not known (the towns): houses up to 1919
  // and of the early 1950s (socialist realism) have pitched roofs, the rest is told by flatKind.
  const built = info?.built;
  if (built) return built < 1920 || (built >= 1946 && built < 1958) ? "sikma" : flatKind(info, n);
  // Nothing known about the building: a tenement in the inner city, a small house elsewhere (least misleading).
  if (!n) return info?.km > innerKm() ? "nizky" : "sikma";
  return info?.km > innerKm() ? flatKind(info, n) : "sikma";
}

// A flat-roofed house: a panel house, or a functionalist tenement in a city block. Told apart by
// the block the OSM building belongs to (blockShape in derive.js): a panel house is a slab at most
// PANEL_WIDTH wide filling its rectangle, a block of few long parts (an L of slabs: PANEL_PART m
// of outline per building or more), 8+ floors, or out on the estates; a house joined into a wider
// block of short houses round a courtyard is a tenement. Checked on 361 OSM apartment houses of 4+
// floors with a building date (evaluation/budovy-typ): 72 % of the 1958–90 ones and 78 % of the
// 1925–45 ones come out right. Offices keep the flat style (drawn as offices by their type).
// A modern block of flats (after 1995): IPR marks it as new against its base map (rare: only the
// newest), or, short of a panel slab, it has a set-back floor outside the inner city (functionalist
// set-backs are an inner-city thing; panel houses have none). Height says nothing: panel houses of
// 4 floors are common (Bára).
const PANEL_WIDTH = 16, PANEL_FILL = 0.65, PANEL_PART = 30, PANEL_FLOORS = 8, estateKm = () => city.estateKm ?? 7;
// The age of the area (IPR "Vývoj zástavby", info.period = the first year it shows as built up) is
// the default, overruled by what is known of the house itself (Bára): built up by 1920 → a house of
// the older town (the tenement look) unless it is a panel slab; by 1950 → a functionalist
// tenement unless a panel slab or a modern set-back block further out; 1970–1990 → the panel era;
// 2010 or later → a modern block of flats. IPR "nová budova" overrules all.
const OLD_SETBACK_KM = 4.5;
function flatKind(info, n) {
  if (OFFICE_TYPES.has(info?.type)) return "plocha";
  if (info?.newBuild) return "moderni"; // IPR "nová budova"
  const b = info?.block;
  const slab = b && ((b.fill >= PANEL_FILL && b.width <= PANEL_WIDTH) || (b.parts >= 2 && (b.length + b.width) / b.parts >= PANEL_PART));
  const setback = !slab && n < PANEL_FLOORS && info?.roof >= 1;
  // The year of the house (RÚIAN) before the age of the area; it is exact, so modern from 1996.
  const p = info?.built ?? info?.period;
  if (p) {
    if (p >= (info?.built ? 1996 : 2010)) return "moderni";
    if (p >= 1970) return setback && info?.km > innerKm() ? "moderni" : "plocha";
    if (slab) return "plocha";
    if (p <= 1920) return "sikma";
    return setback && info?.km > OLD_SETBACK_KM ? "moderni" : "funkce";
  }
  if (setback && info?.km > innerKm()) return "moderni";
  if (n >= PANEL_FLOORS || info?.km >= estateKm()) return "plocha";
  if (b) return slab ? "plocha" : "funkce";
  return info?.km > innerKm() ? "plocha" : "funkce";
}

// A low building has a pitched roof where it is known to (IPR's roof shape), or where it is a house:
// RÚIAN "rodinný dům" or cottage (info.house), an OSM house type, an IPR family house (typ 6, Prague).
// Otherwise (a shop, a school, a garage, nothing known) a plain flat roof (Bára: Most, tř. Budovatelů).
function pitchedLow(info) {
  const roof = IPR_ROOF[info?.roofType];
  if (roof) return roof !== "plocha";
  return !!(info?.house || HOUSE_TYPES.has(info?.type) || (city.id === "praha" && info?.iprKind === 6));
}

// Side outline of a Prague building: floors, storey height, roof floors and the height of each part (cm).
function buildingForm(info, style) {
  const lv = buildingLevels(info);
  const h = buildingHeight(info);
  const n = style === "hala" ? 1 : Math.max(1, lv?.n || (h ? Math.round(h / FLOOR) : DEFAULT_FLOORS[style]));
  const roofRows = style !== "hala" && lv?.roof && lv.cornice ? Math.min(lv.roof, n - 1) : 0;
  const S = STOREY[style];
  // A known height sets the storey (within reason); pitched roofs sit above it.
  const storey = h ? Math.min(S * 1.5, Math.max(S * 0.7, (h * 100) / n)) : S;
  // Tenements have a taller ground floor.
  // A panel house stands on a 100 cm plinth (raised ground floor).
  const ground = style === "sikma" ? storey * 1.2 : style === "funkce" ? storey * 1.15 : style === "plocha" && !OFFICE_TYPES.has(info?.type) ? storey + 90 : storey;
  const body = ground + (n - roofRows - 1) * storey;
  const flat = style === "plocha" || style === "funkce" || style === "moderni" || style === "hala" || (style === "nizky" && !pitchedLow(info));
  const sawtooth = style === "hala" && ["industrial", "manufacture"].includes(info?.type) && IPR_ROOF[info?.roofType] !== "plocha";
  // A family house shows its ridge inside the 4 m strip; a tenement's ridge lies deeper, past the cut.
  const pitched = style === "nizky" ? (RIDGE + 55) * PITCH + 45 : (EDGE + 35) * PITCH + 45;
  const roofH = flat ? roofRows * storey + (sawtooth ? 430 : style === "hala" ? 110 : 50) : roofRows ? roofRows * storey + 170 : pitched;
  return { n, roofRows, storey, ground, body, roofH, flat, chimney: flat ? 0 : 70 };
}

export function edgeHeight(kind, info, style) {
  if (kind !== "budova") return 0;
  if (!cityArt()) return (buildingHeight(info) || 0) * 100;
  const f = buildingForm(info, buildingStyle(info, style));
  return f.body + f.roofH + f.chimney;
}

// Darker or lighter shade of a hex colour (k < 1 darkens).
const tint = (hex, k) => "#" + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)))
  .toString(16).padStart(2, "0")).join("");

// d = distance from the street facade into the building (negative: towards the street), z = height above the surface.
function drawPrahaBuilding(g, x, side, surface, info, chosen) {
  const style = buildingStyle(info, chosen);
  const f = buildingForm(info, style);
  // tint belongs to the house (set by derive.js), so a flipped profile keeps each house's colours.
  const seed = (info?.levels || 0) * 7 + Math.round((info?.km || 0) * 10) + (info?.tint ?? (side === "left" ? 0 : 3));
  const pal = (k) => PALETTES[k][seed % PALETTES[k].length];
  const accent = pal(style === "plocha" ? "plocha" : style === "hala" ? "hala" : style);
  const factory = style === "hala" && ["industrial", "manufacture"].includes(info?.type);
  const sawtooth = factory && IPR_ROOF[info?.roofType] !== "plocha";
  const shop = style === "hala" && ["retail", "supermarket"].includes(info?.type);
  const office = style === "plocha" && OFFICE_TYPES.has(info?.type);
  // A panel house is one colour: the light shade of its insulation colour (Bára: no two-tone field).
  const wall = style === "plocha" ? (office ? pal("plochaWall") : tint(accent, 1.22)) : factory ? BRICK : style === "hala" ? "#cdd4d9" : accent;
  const shade = tint(wall, 0.88), dark = tint(wall, 0.7), trim = tint(wall, 1.12);
  const X = (d) => (side === "left" ? x + EDGE - d : x + d);
  const poly = (pts, fill, extra = {}) => el("path", { d: "M" + pts.map(([d, z]) => `${X(d)} ${surface - z}`).join(" L") + " Z", fill, ...extra }, g);
  const box = (d0, d1, z0, z1, fill, extra) => poly([[d0, z0], [d1, z0], [d1, z1], [d0, z1]], fill, extra);
  const dot = (d, z, r, fill) => el("circle", { cx: X(d), cy: surface - z, r, fill }, g);
  const outline = { stroke: dark, "stroke-width": 1.5, "vector-effect": "non-scaling-stroke" };
  // Half disc of radius r standing on z, centred at d (an arched transom).
  const arch = (d, z, r, fill) => {
    const [x1, x2] = [X(d - r), X(d + r)].sort((a, b) => a - b);
    el("path", { d: `M${x1} ${surface - z} A ${r} ${r} 0 0 1 ${x2} ${surface - z} Z`, fill }, g);
  };
  const top = f.body;
  const full = f.n - f.roofRows;
  const floorZ = (k) => (k === 0 ? 0 : f.ground + (k - 1) * f.storey); // bottom of floor k
  const floorH = (k) => (k === 0 ? f.ground : f.storey);

  // A Streetmix window: cream frame, dark glass with a glint, a transom, a sill with its shadow; now and then
  // a lit pane, a flower box or a curtain.
  const window = (d, z, w, h, n) => {
    const luck = (((n + seed * 31) * 2654435761) >>> 0) % 13; // scatters the lit panes, flowers and curtains
    const lit = luck === 5;
    box(d - 10, d + w + 10, z - 22, z - 10, shade); // shadow under the sill
    box(d - 7, d + w + 7, z - 7, z + h + 7, FRAME);
    box(d, d + w, z, z + h, lit ? LIT : GLASS);
    poly([[d + w * 0.5, z + h], [d + w, z + h], [d + w, z + h * 0.55]], lit ? "#f8e7b5" : GLINT);
    box(d + w / 2 - 3, d + w / 2 + 3, z, z + h, FRAME);
    box(d, d + w, z + h * 0.7 - 3, z + h * 0.7 + 3, FRAME);
    box(d - 12, d + w + 12, z - 12, z - 4, dark); // sill
    if ((luck === 2 || luck === 9 || luck === 11 || n === 3) && !lit) {
      box(d - 4, d + w + 4, z - 28, z - 12, "#9b6a45");
      for (let i = 0; i < 4; i++) dot(d + 6 + (i * (w - 12)) / 3, z - 6, 9, i % 2 ? "#e2607a" : "#6fae4f");
    } else if (luck === 7) { // a net curtain with a wavy hem
      box(d + 4, d + w / 3, z + 14, z + h - 4, "#efe6cf", { "fill-opacity": 0.5 });
      for (let i = 0; i < 3; i++) dot(d + 4 + ((i + 0.5) * (w / 3 - 4)) / 3, z + 14, 5, "#efe6cf");
    }
  };
  // A canopy over a door on the side wall, seen from the front: a slab, its shadow, two brackets.
  const canopy = (d0, d1, z, fill) => {
    const over = Math.min(20, d0 - 4); // never past the facade
    box(d0 - over, d1 + over, z, z + 12, tint(wall, 0.8));
    box(d0 - over, d1 + over, z + 12, z + 32, fill);
    for (const d of [d0 - over + 8, d1 + over - 8]) poly([[d - 6, z + 12], [d + 6, z + 12], [d, z - 14]], tint(fill, 0.85));
  };
  const row = (d0, d1, z, h, n) => {
    const win = WINDOWS[style];
    const count = Math.max(1, Math.floor((d1 - d0 - win.gap) / (win.w + win.gap)));
    const start = d0 + (d1 - d0 - count * win.w - (count - 1) * win.gap) / 2;
    for (let i = 0; i < count; i++) window(start + i * (win.w + win.gap), z, win.w, h, n * 3 + i);
  };

  // --- Roof and gable, behind the wall ---
  if (style === "sikma" && f.roofRows) {
    // Mansard: steep slate slope with a dormer, shallow top; the gable end has the attic windows.
    const rise = f.roofRows * f.storey, run = rise * 0.28, zt = top + rise;
    const zBack = zt + (EDGE - run) * 0.3;
    // Chimney first: the roof and the gable hide its foot.
    box(EDGE - 175, EDGE - 125, zt, zBack + 80, "#c46a4b");
    box(EDGE - 183, EDGE - 117, zBack + 70, zBack + 82, "#8d4a34");
    poly([[0, top], [run, zt], [EDGE, zBack], [EDGE, top]], shade, outline);
    // A slate slab as thick as the tiled ones: dark underside, then the slate, a gutter at the foot and at the break.
    poly([[-30, top - 4], [run - 16, zt + 40], [EDGE, zBack + 40], [EDGE, zBack], [run, zt], [0, top]], ROOF.slate);
    poly([[-8, top], [run - 4, zt + 10], [EDGE, zBack + 10], [EDGE, zBack], [run, zt], [0, top]], ROOF.slateDark);
    dot(-26, top - 6, 10, ROOF.slateDark);
    dot(run - 14, zt + 30, 8, ROOF.slateDark);
    for (let k = 0; k < f.roofRows; k++) row(run + 40, EDGE - 40, top + k * f.storey + 0.25 * f.storey, 0.5 * f.storey, full + k);
    // Dormer: only its cheek shows, between the steep slope and its face, under a little roof.
    const slopeD = (z) => ((z - top) / rise) * run;
    const zb = top + rise * 0.3, zc = zb + 140, dF = Math.max(4, slopeD(zb) - 30);
    poly([[slopeD(zb), zb], [dF, zb], [dF, zc], [slopeD(zc), zc]], tint(ROOF.slate, 1.35), outline);
    box(dF, dF + 10, zb, zc, ROOF.slateDark); // the window frame, edge-on
    poly([[dF - 14, zc], [slopeD(zc), zc], [slopeD(zc), zc + 34], [dF - 14, zc + 14]], ROOF.slateDark); // its little roof
  } else if (!f.flat) {
    const eave = style === "nizky" ? 55 : 35;
    const ridge = style === "nizky" ? RIDGE : EDGE + 200;
    // The underside of the roof meets the wall top at the facade; the eaves reach lower, over the street.
    const z = (d) => top + 12 + Math.min(d, ridge) * PITCH - Math.max(0, d - ridge) * PITCH;
    // Chimney first (the roof hides its foot), then the gable up to the roof, then a thick tiled slab.
    const dc = style === "nizky" ? RIDGE + 50 : EDGE - 80;
    box(dc - 24, dc + 24, top, z(dc) + 100, "#c46a4b");
    box(dc - 32, dc + 32, z(dc) + 90, z(dc) + 102, "#8d4a34");
    poly([[0, top], [Math.min(ridge, EDGE), z(Math.min(ridge, EDGE)) - 12], [EDGE, z(EDGE) - 12], [EDGE, top]], shade, outline);
    const slab = (d0, d1) => {
      poly([[d0, z(d0)], [d1, z(d1)], [d1, z(d1) + 30], [d0, z(d0) + 30]], ROOF.tile);
      poly([[d0, z(d0) - 12], [d1, z(d1) - 12], [d1, z(d1)], [d0, z(d0)]], ROOF.tileDark);
    };
    slab(-eave, Math.min(ridge, EDGE));
    if (ridge < EDGE) slab(ridge, EDGE);
    box(0, EDGE, top - 26, top, shade); // shadow under the eaves
    if (style === "sikma") for (const d of [-eave + 10, -eave / 2 + 2]) box(d - 5, d + 5, top - 16, z(d) - 12, ROOF.tileDark); // brackets
    else dot(-eave + 2, z(-eave) - 16, 10, tint(ROOF.tileDark, 0.9)); // gutter
    if (f.roofRows || style === "nizky") {
      // A window in the gable, under the ridge where the gable is highest, kept clear of the roof.
      const ww = 75, wh = Math.min(95, z(RIDGE - ww / 2 - 10) - 12 - top - 60 - 10);
      window(RIDGE - ww / 2, top + 50, ww, wh, 1);
    } else {
      dot(200, top + 100, 30, FRAME); // a round window in the gable, well under the roof
      dot(200, top + 100, 22, GLASS);
    }
  }

  // --- The side wall, with its plinth (drawn before the door, which stands on the ground) ---
  // Under the building: a cellar band and the same earth as under the street.
  const cellar = GROUND + 60 - surface;
  el("rect", { x, y: surface, width: EDGE, height: cellar, fill: SKLEP }, g);
  box(0, EDGE, -8, 0, tint(SKLEP, 0.85));
  const dCellar = style === "hala" || office ? 32 : 230; // under the ground-floor window, not under the door
  if (!(style === "plocha" && !OFFICE_TYPES.has(info?.type))) { // a panel house has it in the plinth
    box(dCellar, dCellar + 66, -cellar * 0.55 - 6, -cellar * 0.55 + 31, FRAME); // a cellar window
    box(dCellar + 6, dCellar + 60, -cellar * 0.55, -cellar * 0.55 + 25, GLASS);
  }
  el("rect", { x, y: GROUND + 60, width: EDGE, height: 40, fill: "#9b7f5f" }, g);
  box(0, EDGE, 0, top, wall, outline);
  box(EDGE - 30, EDGE, 0, top, shade); // the wall turns away at the cut
  const plinth = office ? [20, "#8a867d"] : { sikma: [90, STONE], funkce: [60, "#8f887c"], moderni: [30, "#56585b"], plocha: [100, "#8a867d"], nizky: [60, "#a59c88"] }[style];
  if (plinth) box(-8, EDGE - 30, 0, plinth[0], plinth[1]);

  // Windows and the ground floor.
  if (factory) {
    // A Prague brick factory hall: brick courses, a dark plinth, tall gridded industrial windows.
    for (let z = 30; z < top; z += 30) box(0, EDGE - 30, z - 2, z + 2, tint(wall, 0.88));
    box(0, EDGE - 30, 0, 70, "#8a5a48");
    const wh = Math.min(top - 220, 420), z0 = 120;
    for (const d of [130, 255]) {
      box(d - 8, d + 108, z0 - 8, z0 + wh + 8, FRAME);
      box(d, d + 100, z0, z0 + wh, GLASS);
      poly([[d + 50, z0 + wh], [d + 100, z0 + wh], [d + 100, z0 + wh * 0.6]], GLINT);
      for (let k = 33; k < 100; k += 33) box(d + k - 2, d + k + 2, z0, z0 + wh, FRAME);
      for (let k = 40; k < wh; k += 40) box(d, d + 100, z0 + k - 2, z0 + k + 2, FRAME);
      box(d - 14, d + 114, z0 + wh + 8, z0 + wh + 22, tint(wall, 0.75)); // brick lintel
    }
    // A plank door with an arched brick head, standing on the ground near the street.
    box(10, 120, 0, 14, "#9a8a7c");
    box(18, 112, 14, 270, tint(wall, 0.75));
    box(26, 104, 14, 262, DOOR);
    for (let d = 39; d < 104; d += 13) box(d - 1, d + 1, 14, 262, tint(DOOR, 0.8));
    arch(65, 270, 47, tint(wall, 0.75));
    arch(65, 270, 39, GLASS);
  } else if (style === "hala") {
    // The ribbon window stays above the door or gate (a low hall gets a lower gate and a slimmer band).
    const gateH = Math.min(340, top * 0.5), shopH = Math.min(310, top * 0.5);
    const zr = Math.max(top * 0.55, (shop ? shopH : gateH) + 50), hr = Math.min(170, top * 0.25, top - 90 - zr);
    for (let d = 20; d < EDGE - 30; d += 30) box(d, d + 3, 0, top - 40, shade); // corrugated cladding
    if (hr >= 40) {
      box(0, EDGE - 30, zr - 8, zr + hr + 8, FRAME);
      box(8, EDGE - 38, zr, zr + hr, GLASS);
      poly([[EDGE - 170, zr + hr], [EDGE - 120, zr + hr], [EDGE - 180, zr], [EDGE - 230, zr]], GLINT);
      const span = EDGE - 46, parts = Math.round(span / 120);
      for (let i = 1; i < parts; i++) box(8 + (i * span) / parts - 3, 8 + (i * span) / parts + 3, zr, zr + hr, FRAME);
    }
    box(0, EDGE - 30, top - 80, top - 40, accent); // coloured band
    if (shop) {
      box(0, 190, 0, shopH, FRAME);
      box(8, 182, 0, shopH - 10, GLASS);
      box(93, 97, 0, shopH - 10, FRAME);
      poly([[100, shopH - 10], [182, shopH - 10], [182, shopH - 110]], GLINT);
    } else {
      box(150, 340, 0, gateH, "#9aa3aa", outline); // roller door
      for (let z = 20; z < gateH; z += 30) box(150, 340, z, z + 4, "#868f96");
    }
  } else if (office) {
    // Offices: ribbon windows with mullions, a glazed ground floor.
    for (let k = 0; k < full; k++) {
      const z0 = floorZ(k), h = floorH(k);
      box(0, EDGE - 40, z0 + h * 0.08, z0 + h * (k ? 0.82 : 0.9), FRAME);
      box(8, EDGE - 48, z0 + h * 0.12, z0 + h * (k ? 0.78 : 0.86), GLASS);
      const gTop = z0 + h * (k ? 0.78 : 0.86);
      poly([[EDGE - 150, gTop], [EDGE - 100, gTop], [EDGE - 160, z0 + h * 0.12], [EDGE - 210, z0 + h * 0.12]], GLINT);
      for (let d = 8 + 120; d < EDGE - 48; d += 120) box(d - 3, d + 3, z0 + h * 0.12, gTop, FRAME);
      if (k) { box(0, EDGE, z0 - 4, z0 + h * 0.08, accent); box(EDGE - 30, EDGE, z0 - 4, z0 + h * 0.08, tint(accent, 0.9)); } // spandrel band
    }
    box(14, 116, 0, 262, FRAME); // glazed entrance with a flat canopy
    box(22, 108, 0, 254, GLASS);
    box(63, 67, 0, 254, FRAME);
    canopy(14, 116, 262, dark);
  } else if (style === "moderni") {
    // A new-built block of flats (after 1995): crisp render with an accent panel (anthracite or
    // larch), tall windows down to the floor in anthracite frames, a glazed lobby on the ground
    // floor; glass balconies and the slab edges are drawn with what sticks out.
    const ANTH = "#3c3f43", LARCH = "#b98a5a";
    const accentPanel = seed % 2 ? ANTH : LARCH;
    box(EDGE - 150, EDGE - 30, plinth[0], top, accentPanel); // the accent panel at the back
    if (accentPanel === LARCH) for (let d = EDGE - 140; d < EDGE - 30; d += 14) box(d, d + 2, plinth[0], top, tint(LARCH, 0.85));
    // Lobby: a glazed entrance, anthracite frame, a letter-box panel.
    box(10, 150, plinth[0], f.ground - 30, ANTH);
    box(18, 142, plinth[0] + 8, f.ground - 38, GLASS);
    poly([[90, f.ground - 38], [142, f.ground - 38], [142, f.ground - 120]], GLINT);
    box(78, 82, plinth[0] + 8, f.ground - 38, ANTH);
    box(165, EDGE - 165, plinth[0] + 60, f.ground - 50, ANTH); // ground-floor window
    box(171, EDGE - 171, plinth[0] + 66, f.ground - 56, GLASS);
    const french = (d0, d1, z, h, n) => { // a window to the floor with a fixed lower pane
      const luck = (((n + seed * 31) * 2654435761) >>> 0) % 13;
      box(d0, d1, z, z + h, ANTH);
      box(d0 + 5, d1 - 5, z + 5, z + h - 5, luck === 5 ? LIT : GLASS);
      poly([[d0 + (d1 - d0) * 0.5, z + h - 5], [d1 - 5, z + h - 5], [d1 - 5, z + h * 0.55]], luck === 5 ? "#f8e7b5" : GLINT);
      box(d0, d1, z + 95, z + 99, ANTH); // the glass balustrade's line inside
      box((d0 + d1) / 2 - 2, (d0 + d1) / 2 + 2, z + 99, z + h, ANTH);
    };
    for (let k = 1; k < full; k++) {
      const z0 = floorZ(k), h = f.storey;
      french(20, 120, z0 + 10, 0.82 * h, k * 3); // to the balcony at the street end
      french(150, EDGE - 160, z0 + 10, 0.82 * h, k * 3 + 1);
      box(0, EDGE - 30, z0 - 3, z0 + 3, tint(wall, 0.9)); // floor line
    }
  } else if (style === "funkce") {
    // A functionalist tenement (1925–45): smooth light plaster in horizontal bands (a parapet band
    // on every floor), a clad ground floor with a shop window in a steel frame and the house door
    // under a thin canopy, "Prague windows" (a large undivided fixed pane between two narrow
    // casements with top lights) lying flat, a balcony door at the street end, sometimes a bay.
    const STEEL = "#3f4144";
    const cladding = seed % 2 ? ["#d8ccb3", 40, 1000] : seed % 4 === 0 ? ["#4f6a5a", 20, 10] : ["#7a4a3c", 20, 10];
    const [clad, cw, chh] = cladding; // travertine slabs, or ceramic tiles 20 × 10 cm
    box(0, EDGE - 30, plinth[0], f.ground - 20, clad);
    for (let z = plinth[0] + (chh < 100 ? chh : 40); z < f.ground - 20; z += chh < 100 ? chh : 40) box(0, EDGE - 30, z - 0.5, z + 0.5, chh < 100 ? "#e9e4d8" : tint(clad, 0.9), chh < 100 ? { "fill-opacity": 0.5 } : {});
    for (let d = cw; d < EDGE - 30; d += cw) box(d - 0.5, d + 0.5, plinth[0], f.ground - 20, chh < 100 ? "#e9e4d8" : tint(clad, 0.9), chh < 100 ? { "fill-opacity": 0.5 } : {});
    // House door: steel, glass behind a three-bar grille, a top light, a thin canopy over the pavement.
    const doorTop = Math.min(240, f.ground - 90);
    box(14, 134, 0, doorTop + 48, STEEL);
    box(22, 126, 8, doorTop, GLASS);
    box(22, 126, doorTop + 8, doorTop + 40, GLASS);
    for (let z = 60; z < doorTop; z += 30) box(22, 126, z, z + 4, STEEL);
    box(-90, 0, doorTop + 52, doorTop + 58, tint(wall, 0.7));
    box(-90, 140, doorTop + 58, doorTop + 70, trim, outline);
    // Shop: a big window in a steel frame on a granite sill, the fascia for its lettering.
    const s0 = 160, s1 = EDGE - 40, sTop = f.ground - 80;
    box(s0 - 6, s1 + 6, 40, sTop + 6, STEEL);
    box(s0, s1, 46, sTop, GLASS);
    poly([[s0 + (s1 - s0) * 0.55, sTop], [s1, sTop], [s1, sTop - 120]], GLINT);
    box((s0 + s1) / 2 - 2, (s0 + s1) / 2 + 2, 46, sTop, STEEL);
    box(s0 - 6, s1 + 6, sTop + 6, sTop + 36, "#efe6d2", outline); // fascia with "letters"
    for (let i = 0; i < 4; i++) box(s0 + 20 + i * 34, s0 + 38 + i * 34, sTop + 14, sTop + 28, STEEL);
    const W = Math.min(200, EDGE - 30 - 150 - 20), wd = 150;
    const prague = (z, h, n) => { // the "Prague window": thin frames, the middle pane undivided
      const luck = (((n + seed * 31) * 2654435761) >>> 0) % 13, d = wd, w = W;
      box(d - 4, d + w + 4, z - 4, z + h + 4, FRAME);
      box(d, d + w, z, z + h, luck === 5 ? LIT : GLASS);
      poly([[d + w * 0.5, z + h], [d + w * 0.78, z + h], [d + w * 0.78, z + h * 0.45]], luck === 5 ? "#f8e7b5" : GLINT);
      for (const t of [0.22, 0.78]) box(d + w * t - 2, d + w * t + 2, z, z + h, FRAME);
      for (const [a0, a1] of [[d, d + w * 0.22], [d + w * 0.78, d + w]]) box(a0, a1, z + h * 0.74 - 2, z + h * 0.74 + 2, FRAME); // top lights of the casements
      if (luck === 2 || luck === 9) for (let i = 0; i < 5; i++) dot(d + 10 + (i * (w - 20)) / 4, z + 4, 8, i % 2 ? "#e2607a" : "#6fae4f");
    };
    for (let k = 1; k < full; k++) {
      const z0 = floorZ(k), h = f.storey, sill = z0 + 0.3 * h;
      box(0, EDGE - 30, sill - 60, sill - 10, tint(wall, 0.95)); // parapet zone and band: the horizontal lines
      box(-4, EDGE - 30, sill - 10, sill - 2, "#f4efe4", outline);
      prague(sill, 0.48 * h, k);
      box(20, 104, z0, z0 + 0.82 * h, FRAME); // balcony door at the street end
      box(25, 99, z0 + 5, z0 + 0.82 * h - 5, GLASS);
      box(25, 99, z0 + 0.62 * h, z0 + 0.62 * h + 4, FRAME);
    }
  } else if (style === "plocha") {
    // A panel house (revitalised): the panel grid of joints, loggias let into the corner by the
    // street with coloured parapets, wide windows in the panel bays, an entrance under a slab.
    // Sizes of a Czech panel house (cm; T06B, VVÚ-ETA, PS-69): storey 280, a raised ground floor on
    // a 100 cm plinth, windows 200 × 150 on a 90 cm parapet set deep in the insulation, loggias
    // 120 deep at the street corner, the entrance at street level, panel joints showing through.
    const LOG = 120; // depth of the loggias from the street facade
    const STEP = 0; // the entrance is level with the pavement (Bára)
    const joint = tint(wall, 0.76);
    // A storey stretched by the building's known height (often 3.3–3.5 m from IPR) gets a taller
    // window on a higher parapet, so the wall between the rows does not gape.
    const WW = 190, WH = Math.min(175, 150 + Math.max(0, f.storey - 280) * 0.4), WD = (LOG + EDGE - 34 - WW) / 2;
    const SILL = Math.min(90 + Math.max(0, f.storey - 280) * 0.3, f.storey - WH - 30);
    const PVC = "#f6f3ec";
    // A revitalised window: white plastic in three upright panes (Bára), in a deep reveal of the
    // insulation, a grey metal sill; a lit pane or flowers now and then.
    const panelWindow = (z, n) => {
      const luck = (((n + seed * 31) * 2654435761) >>> 0) % 11;
      const d = WD, w = WW, h = WH;
      box(d - 8, d + w + 8, z - 2, z + h + 8, tint(wall, 0.82)); // reveal
      box(d, d + w, z, z + h, PVC);
      box(d + 7, d + w - 7, z + 7, z + h - 7, luck === 4 ? LIT : GLASS);
      box(d + 7, d + w - 7, z + h - 15, z + h - 7, tint(luck === 4 ? LIT : GLASS, 0.75)); // shade of the lintel
      poly([[d + w * 0.62, z + h - 15], [d + w - 7, z + h - 15], [d + w - 7, z + h * 0.45]], luck === 4 ? "#f8e7b5" : GLINT);
      for (const t of [1 / 3, 2 / 3]) box(d + w * t - 4, d + w * t + 4, z, z + h, PVC); // mullions
      box(d - 12, d + w + 12, z - 9, z - 5, tint(wall, 0.9)); // shadow under the sill
      box(d - 12, d + w + 12, z - 5, z, "#c9ccd0"); // metal sill
      if (luck === 1 || luck === 8) for (let i = 0; i < 5; i++) dot(d + 14 + (i * (w - 28)) / 4, z + 6, 8, i % 2 ? "#d9748a" : "#7f9f6a");
    };
    // Cellar window in the plinth, above the pavement.
    box(200, 290, 30, 70, "#d9d6cf");
    box(206, 284, 36, 64, GLASS);
    // Entrance: level with the pavement, an anodised aluminium portal: a door leaf with a vertical handle,
    // a fixed side panel, a top light, a kick plate; a thin concrete canopy over it. It stands in
    // the column of the loggias, inside the facade.
    const ALU = "#bcbab4", door0 = 16, door1 = LOG - 8, doorTop = STEP + 210, lightTop = Math.min(STEP + 270, f.ground - 16);
    box(door0 - 6, door1 + 6, 0, 6, tint(plinth[1], 1.15)); // threshold
    box(door0 - 10, door1 + 10, STEP, lightTop + 10, tint(wall, 0.86)); // reveal around the portal
    box(door0, door1, STEP, lightTop, ALU);
    const panes = [[door0 + 8, door0 + 68], [door0 + 76, door1 - 8]]; // door leaf, side panel
    const ENTRY_GLASS = "#4a5578"; // lighter than the windows: the lit staircase shows through
    box(door0 + 8, door1 - 8, STEP + 8, STEP + 48, tint(ALU, 0.85)); // kick plate
    for (const [d0, d1] of panes) {
      box(d0, d1, STEP + 48, doorTop - 6, ENTRY_GLASS);
      poly([[d0 + (d1 - d0) * 0.55, doorTop - 6], [d1, doorTop - 6], [d1, doorTop - 60]], "#6a7396");
    }
    box(door0 + 56, door0 + 63, STEP + 80, STEP + 140, "#7d7a74"); // handle on the leaf
    box(door0 + 8, door1 - 8, doorTop + 2, lightTop - 8, ENTRY_GLASS); // top light
    panelWindow(plinth[0] + SILL, 0);
    for (let k = 1; k < full; k++) {
      const z0 = floorZ(k), h = f.storey;
      // The loggia: a recess, its ceiling slab, a solid parapet in the accent colour under a light coping.
      box(0, LOG, z0, z0 + h, tint(wall, 0.55));
      box(0, LOG, z0 + h - 18, z0 + h, tint(wall, 0.78));
      box(0, LOG, z0, z0 + 101, accent, outline);
      box(0, LOG, z0 + 98, z0 + 101, tint(accent, 0.7));
      box(-4, LOG, z0 + 101, z0 + 107, "#e8e5de"); // coping
      if ((k + seed) % 4 === 1) { box(28, 58, z0 + 107, z0 + 129, "#b5714a"); dot(43, z0 + 140, 15, "#7f9f6a"); }
      panelWindow(z0 + SILL, k);
    }
    // Joints over everything: one at every floor, one at the loggias, one at the back.
    for (let k = 1; k <= full; k++) box(0, EDGE - 30, floorZ(k) - 2, floorZ(k) + 3, joint);
    box(0, EDGE - 30, plinth[0] - 2, plinth[0] + 2, tint(plinth[1], 0.8)); // top of the plinth
    box(LOG - 2, LOG + 3, lightTop + 30, top, joint); // the loggia joint starts above the canopy
    box(EDGE - 36, EDGE - 31, plinth[0], top, joint);
    box(-40, LOG, lightTop + 4, lightTop + 10, tint(wall, 0.6)); // canopy: shadow, slab, flashing
    box(-40, LOG, lightTop + 10, lightTop + 28, "#c4bfb5", outline);
    box(-40, LOG, lightTop + 28, lightTop + 31, "#9a9690");
  } else {
    // Door near the street (arched in a tenement), windows behind it, and on every floor above.
    const doorH = Math.min(240, f.ground * 0.72);
    box(10, 120, 0, 14, tint(plinth?.[1] || STONE, 1.15)); // doorstep
    box(16, 114, 14, doorH + 10, FRAME);
    box(24, 106, 14, doorH, DOOR);
    dot(94, doorH * 0.4, 5, "#f2d27a");
    if (style === "sikma") { arch(65, doorH + 10, 49, FRAME); arch(65, doorH + 10, 41, GLASS); } // arched transom
    else {
      box(30, 100, doorH * 0.7, doorH - 8, GLASS);
      canopy(16, 114, doorH + 10, style === "nizky" ? ROOF.tile : dark);
    }
    // The windows above stand in the axes of the door and of the ground-floor window.
    const win = WINDOWS[style];
    const groundAt = (125 + EDGE - 30 - win.w) / 2;
    window(groundAt, f.ground * win.sill + (style === "sikma" ? 40 : 0), win.w, win.h * f.storey, 0);
    const front = Math.max(65, 35 + win.w / 2); // the front axis keeps clear of the facade
    for (let k = 1; k < full; k++) {
      for (const [i, c] of [front, groundAt + win.w / 2].entries()) window(c - win.w / 2, floorZ(k) + win.sill * f.storey, win.w, win.h * f.storey, k * 3 + i);
    }
  }

  // --- Flat roof: parapet, set-back floors, factory roof lights ---
  if (f.flat) {
    const back = f.roofRows ? (style === "funkce" || style === "moderni" ? 200 : 160) : 0;
    if (f.roofRows) {
      if (style === "moderni") { // a terrace behind a glass balustrade in front of the set-back floor
        box(-30, EDGE, top - 8, top + 14, "#e9e8e4", outline);
        box(-26, back, top + 14, top + 110, "#bcd3dc", { "fill-opacity": 0.55 });
        box(-26, back, top + 106, top + 112, "#8e9aa0");
      } else if (style === "funkce") { // a roof terrace with a tubular railing in front of the set-back floor
        box(-45, EDGE, top - 12, top + 12, trim, outline);
        for (const z of [55, 100]) box(-30, back, top + z, top + z + 5, "#5d5f62");
        for (const d of [-30, back / 2 - 10]) box(d, d + 5, top + 12, top + 105, "#5d5f62");
      } else box(0, back, top, top + 40, tint(wall, 0.93), outline); // parapet in front of the set-back floor
      box(back, EDGE - 40, top, top + f.roofRows * f.storey, wall, outline);
      if (style === "funkce" || style === "moderni") { // the set-back floor is glazed towards its terrace: one band
        for (let k = 0; k < f.roofRows; k++) {
          const z = top + k * f.storey + 0.25 * f.storey, h = 0.55 * f.storey;
          box(back + 6, EDGE - 46, z - 4, z + h + 4, FRAME);
          box(back + 10, EDGE - 50, z, z + h, GLASS);
          for (let d = back + 10 + 55; d < EDGE - 50; d += 55) box(d - 2, d + 2, z, z + h, FRAME);
        }
      } else for (let k = 0; k < f.roofRows; k++) row(back, EDGE - 40, top + k * f.storey + 0.3 * f.storey, 0.45 * f.storey, full + k);
    }
    const zr = top + f.roofRows * f.storey;
    if (sawtooth) {
      // Saw-tooth roof lights standing on the roof, and a brick chimney behind.
      box(EDGE - 120, EDGE - 70, zr, zr + 420, wall, outline);
      for (let z = zr + 30; z < zr + 420; z += 30) box(EDGE - 120, EDGE - 70, z - 2, z + 2, tint(wall, 0.85));
      box(EDGE - 126, EDGE - 64, zr + 405, zr + 420, "#8a5a48");
      const tooth = (d) => zr + 170 - (d * 170) / 180; // height of the tooth's slope
      for (const d0 of [0, 180]) {
        poly([[d0, zr], [d0, zr + 170], [d0 + 180, zr]], ROOF.slate, outline);
        poly([[d0, zr], [d0, zr + 170], [d0 + 26, tooth(26)], [d0 + 26, zr]], FRAME);
        poly([[d0 + 5, zr + 8], [d0 + 5, zr + 160], [d0 + 21, tooth(21) - 8], [d0 + 21, zr + 8]], GLASS);
        poly([[d0 + 5, zr + 110], [d0 + 5, zr + 140], [d0 + 21, zr + 90], [d0 + 21, zr + 60]], GLINT);
      }
    } else {
      if (style === "plocha" && !office && !f.roofRows) { // the lift's machine room on the roof
        box(EDGE - 230, EDGE - 70, zr, zr + 230, tint(wall, 0.92), outline);
        box(EDGE - 236, EDGE - 64, zr + 222, zr + 236, dark);
        box(EDGE - 190, EDGE - 150, zr + 120, zr + 170, "#8f979d"); // louvre
      }
      if (style === "hala") { // an air-handling unit on the roof
        box(EDGE - 150, EDGE - 60, zr, zr + 100, "#aab2b8", outline);
        for (let d = EDGE - 140; d < EDGE - 70; d += 18) box(d, d + 8, zr + 50, zr + 88, "#8f979d");
      }
      if (style === "moderni") { // a crisp parapet with a dark coping
        box(back - 4, f.roofRows ? EDGE - 32 : EDGE, zr, zr + 50, wall, outline);
        box(back - 8, f.roofRows ? EDGE - 32 : EDGE, zr + 50, zr + 56, "#3c3f43");
      } else if (style === "funkce") { // a thin slab overhanging the wall, its shadow under it
        box(back, f.roofRows ? EDGE - 32 : EDGE, zr - 12, zr, shade);
        box(back - 45, f.roofRows ? EDGE - 32 : EDGE, zr, zr + 24, trim, outline);
      } else {
        box(back - 8, f.roofRows ? EDGE - 32 : EDGE, zr, zr + 40, tint(wall, 0.93), outline);
        box(back - 8, f.roofRows ? EDGE - 32 : EDGE, zr + 32, zr + 42, dark);
      }
    }
  }

  // --- What sticks out towards the street ---
  box(0, 10, plinth ? plinth[0] : 0, top, dark); // the street facade, seen edge-on
  if (style === "sikma") {
    box(-18, EDGE, f.ground - 18, f.ground, trim, outline); // string course
    box(EDGE - 30, EDGE, f.ground - 18, f.ground, tint(trim, 0.9));
    box(-18, EDGE, f.ground - 30, f.ground - 18, shade);
    // Main cornice in three steps, the wall's colour lightened, with its shadow on the wall.
    const corn = tint(wall, 1.15);
    box(-14, EDGE, top - 58, top - 44, corn, outline);
    box(-28, EDGE, top - 44, top - 22, corn, outline);
    box(-44, EDGE, top - 22, top, corn, outline);
    box(EDGE - 30, EDGE, top - 58, top, tint(corn, 0.9));
    box(0, EDGE, top - 76, top - 58, shade);
  } else if (style === "moderni") {
    for (let k = 1; k < full; k++) { // balconies: a thin white slab, a frameless glass balustrade
      const z = floorZ(k);
      box(-140, 0, z - 4, z, tint(wall, 0.75));
      box(-145, 0, z, z + 18, "#f4f3f0", outline);
      box(-140, -4, z + 18, z + 110, "#bcd3dc", { "fill-opacity": 0.5 });
      box(-140, -4, z + 106, z + 110, "#8e9aa0");
      if ((k + seed) % 3 === 2) { box(-110, -80, z + 18, z + 42, "#9c9a92"); dot(-95, z + 56, 16, "#6fae4f"); }
    }
    box(-60, 160, f.ground - 22, f.ground - 10, "#3c3f43"); // canopy over the lobby
  } else if (style === "funkce") {
    box(-30, EDGE, f.ground - 20, f.ground, trim, outline); // a band over the ground floor
    // About two houses in five have a bay over the street from the 2nd floor up (Žižkov, Vršovice);
    // the others, and the 1st floor under a bay, have balconies with a solid lower part and one rail.
    const bay = seed % 5 < 2 && full >= 4;
    if (bay) {
      const z0 = floorZ(2) - 30, z1 = floorZ(full - 1) + f.storey;
      box(-80, 0, z0 - 10, z0, tint(wall, 0.8)); // soffit
      box(-80, 0, z0, z1, tint(wall, 1.03), outline);
      for (let k = 2; k < full; k++) {
        const zw = floorZ(k) + 0.3 * f.storey;
        box(-65, -15, zw - 4, zw + 0.48 * f.storey + 4, FRAME);
        box(-61, -19, zw, zw + 0.48 * f.storey, GLASS);
      }
    }
    for (let k = 1; k < (bay ? 2 : full); k++) {
      const z = floorZ(k), RAIL = "#5d5f62";
      box(-120, 0, z - 6, z, tint(wall, 0.8));
      box(-125, 0, z, z + 12, trim, outline); // slab
      box(-120, -4, z + 12, z + 60, tint(wall, 0.97), outline); // solid lower part
      box(-120, 0, z + 95, z + 100, RAIL); // the rail
      for (const d of [-120, -70, -20]) box(d, d + 4, z + 60, z + 95, RAIL);
      if ((k + seed) % 3 === 1) { box(-90, -60, z + 60, z + 80, "#b5714a"); dot(-75, z + 92, 14, "#6fae4f"); }
    }
  } else if (style === "hala") {
    box(-4, 0, 0, top, dark);
    if (shop) {
      // The awning's side: a wedge sloping out over the entrance, stripes along it, a scalloped valance, an arm.
      // It sits just above the shop window, so a low hall gets it lower too.
      const shopH = Math.min(310, top * 0.5);
      const z0 = shopH + 110, z1 = z0 - 80, reach = 240;
      const aOut = { stroke: tint(accent, 0.75), "stroke-width": 1.5, "vector-effect": "non-scaling-stroke" };
      poly([[0, z0 + 30], [-reach, z1], [-reach, z1 - 60], [0, z0 - 30]], accent, aOut);
      for (const k of [14, 34]) poly([[0, z0 + 30 - k], [-reach, z1 - k], [-reach, z1 - k - 8], [0, z0 + 22 - k]], "#fbf6ea");
      box(-reach, -reach + 14, z1 - 100, z1 - 60, accent, aOut); // valance
      dot(-reach + 7, z1 - 100, 10, accent); // scalloped hem
      poly([[0, shopH - 10], [-reach + 10, z1 - 60], [-reach + 4, z1 - 66], [0, shopH - 18]], "#5f666c");
      // A projecting sign, seen flat from the side, with a trolley on it, on the wall above the
      // awning where there is room, else standing on the roof.
      const zs = Math.min(Math.max(500, top * 0.7), top - 130) >= z0 + 50 ? Math.min(Math.max(500, top * 0.7), top - 130) : top + 60;
      if (zs > top) box(-100, -90, top, zs, dark); // the sign's post on the roof edge
      box(-20, 0, zs + 45, zs + 62, dark);
      box(-170, -20, zs, zs + 110, accent, aOut);
      dot(-95, zs + 55, 40, "#fbf6ea");
      poly([[-120, zs + 70], [-70, zs + 70], [-78, zs + 48], [-112, zs + 48]], accent);
      dot(-110, zs + 40, 6, accent);
      dot(-80, zs + 40, 6, accent);
    }
  }
  return surface - (top + f.roofH + f.chimney);
}

// The floor count above an edge building starts at its outer side, clear of the cut end A/B.
const floorLabelAt = (x, side) => (side === "left" ? { x: x + 12, "text-anchor": "start" } : { x: x + EDGE - 12, "text-anchor": "end" });

function drawEdge(svg, x, kind, side, surface, info, style) {
  const g = el("g", {}, svg);
  if (kind === "budova" && cityArt()) {
    let top = drawPrahaBuilding(g, x, side, surface, info, style);
    if (top < labelTop) {
      // Cut off above the view: a torn edge in the background colour says the building goes on.
      const yb = labelTop + 20;
      let d = `M${x - 4} ${yb - 4000} L${x - 4} ${yb}`;
      for (let i = 0; i <= 8; i++) d += ` L${x + (i * (EDGE + 8)) / 8 - 4} ${yb + (i % 2 ? 22 : 0)}`;
      el("path", { d: d + ` L${x + EDGE + 4} ${yb - 4000} Z`, fill: "#fbfaf6" }, g);
      // Balconies and cornices over the street are cut at the same line.
      el("rect", { x: side === "left" ? x + EDGE : x - 160, y: yb - 4000, width: 160, height: 4000 - 4, fill: "#fbfaf6" }, g);
      top = yb - 10;
      g.dataset.top = top; // what shows of it, for the page fitting the view (app.js layoutTop)
    }
    const lv = buildingLevels(info);
    const h = buildingHeight(info);
    if (lv || h) {
      const text = lv ? (lv.cornice && lv.roof ? `${lv.cornice} + ${lv.roof} NP` : `${lv.n} NP`)
        : buildingStyle(info, style) === "hala" ? "hala" : "";
      el("text", { ...floorLabelAt(x, side), y: top - 25, "font-size": 32, fill: "#4f4e49", class: "lbl-floor", "data-w": EDGE - 24, "data-free": 1 }, g).textContent =
        [text, h ? `${info.height ? "" : "≈ "}${fmt(h).replace(",00", "")}` : ""].filter(Boolean).join(" · ");
    }
  } else if (kind === "budova") {
    const h = buildingHeight(info);
    const lv = buildingLevels(info);
    const top = h ? surface - h * 100 : 120;
    const rows = lv?.n || 5;
    const fh = (surface - top) / rows;
    // Roof / set-back floors above the cornice are drawn narrower and darker.
    const roofRows = lv?.roof && lv.cornice ? lv.roof : 0;
    const corniceY = surface - (rows - roofRows) * fh;
    const inset = roofRows ? 80 : 0;
    if (roofRows) {
      const rx = side === "left" ? x : x + inset;
      el("rect", { x: rx, y: top, width: EDGE - inset, height: corniceY - top, fill: "#c9bfae", stroke: "#b9ad97", "stroke-width": 3 }, g);
    }
    el("rect", { x, y: corniceY, width: EDGE, height: surface - corniceY, fill: "#ddd3c2", stroke: "#b9ad97", "stroke-width": 3 }, g);
    for (let row = 0; row < rows; row++) {
      const above = row < roofRows;
      for (let col = 0; col < 3; col++) {
        const wx = x + 50 + col * 120;
        if (above && (side === "left" ? wx + 70 > x + EDGE - inset : wx < x + inset)) continue;
        el("rect", { x: wx, y: top + row * fh + fh * 0.25, width: 70, height: fh * 0.5, fill: "#9fb4c2" }, g);
      }
    }
    if (lv) {
      const text = lv.cornice && lv.roof ? `${lv.cornice} + ${lv.roof} NP` : `${lv.n} NP`;
      el("text", { ...floorLabelAt(x, side), y: top - 25, "font-size": 32, fill: "#4f4e49", class: "lbl-floor", "data-w": EDGE - 24, "data-free": 1 }, g).textContent =
        text + (h ? ` · ${info.height ? "" : "≈ "}${fmt(h).replace(",00", "")}` : "");
    }
  } else if (kind === "stavba") {
    // Minor structure (garage, kiosk, wall): a low block.
    el("rect", { x, y: surface, width: EDGE, height: 60 + GROUND - surface, fill: "#e6e3da" }, g);
    const bx = side === "left" ? x + EDGE - 220 : x;
    el("rect", { x: bx, y: surface - 260, width: 220, height: 260, fill: "#cfc8ba", stroke: "#b9ad97", "stroke-width": 3 }, g);
  } else if (kind === "zahrada") {
    el("rect", { x, y: surface, width: EDGE, height: 60 + GROUND - surface, fill: "#a7c66b" }, g);
    const fx = side === "left" ? x + EDGE - 10 : x;
    el("rect", { x: fx, y: surface - 140, width: 10, height: 140, fill: "#6b6a65" }, g);
    for (let k = 0; k < 4; k++) el("rect", { x: side === "left" ? x + EDGE - 160 : x, y: surface - 140 + k * 40, width: 170, height: 6, fill: "#6b6a65" }, g);
    sprite(g, "bush", x + EDGE / 2, surface);
    sprite(g, "tree", side === "left" ? x + 120 : x + EDGE - 120, surface);
  } else if (kind === "voda") {
    el("rect", { x, y: GROUND + 20, width: EDGE, height: 80, fill: "#7fa9cf" }, g);
  } else if (kind === "plot") {
    // Fence or wall: the ground behind it is outside the street.
    el("rect", { x, y: surface, width: EDGE, height: 60 + GROUND - surface, fill: "#e6e3da" }, g);
    const fx = side === "left" ? x + EDGE - 10 : x;
    el("rect", { x: fx, y: surface - 160, width: 10, height: 160, fill: "#6b6a65" }, g);
    for (let k = 0; k < 3; k++) el("rect", { x: side === "left" ? x + EDGE - 120 : x, y: surface - 150 + k * 50, width: 130, height: 6, fill: "#6b6a65" }, g);
  } else if (kind === "parkoviste") {
    el("rect", { x, y: GROUND, width: EDGE, height: 60, fill: "#7b7b78" }, g);
    sprite(g, "car-sideways-left", x + EDGE / 2, GROUND);
  } else if (kind === "zelen") {
    el("rect", { x, y: surface, width: EDGE, height: 60 + GROUND - surface, fill: "#8fbf55" }, g);
    sprite(g, "tree", x + EDGE / 2, surface);
  } else {
    el("rect", { x, y: surface, width: EDGE, height: 60 + GROUND - surface, fill: "#e6e3da" }, g);
  }
  el("text", { class: "lbl-t", "data-row": 1, "data-w": EDGE, x: x + EDGE / 2, y: GROUND + 215, "text-anchor": "middle", "font-size": 30, fill: "#6b6a65" },
    g).textContent = { budova: "Budova", stavba: "Drobná stavba", voda: "Vodní tok / plocha", zahrada: "Zahrada, louka (mimo ulici)", zelen: "Zeleň (mimo ulici)", parkoviste: "Parkoviště (mimo ulici)", plot: "Za plotem (mimo ulici)" }[kind] || "";
  return g;
}

// Build an SVG element. opts: {editable, selected, view: [x0, width], onSelect(i)}
// Traffic-sign icons (znacky/), loaded on first use: file → { uri, w, h }. A template (B 20a with another speed,
// E 13 with a text) gets its text filled in before it becomes a data URI.
const signArt = new Map();
const signKey = (file, text) => (text ? `${file}|${text}` : file);
async function loadSignFile(file, text) {
  const key = signKey(file, text);
  if (signArt.has(key)) return;
  signArt.set(key, null);
  try {
    const r = await fetch(`znacky/${file}.svg`);
    if (!r.ok) throw new Error(r.status);
    let svg = await r.text();
    if (text) svg = svg.replace(/(<text id="[vt]"[^>]*>)[^<]*/, `$1${text.replace(/[<&]/g, "")}`);
    const vb = svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
    signArt.set(key, { uri: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), w: vb[2], h: vb[3] });
  } catch (err) {
    console.warn("značka chybí", file, err.message);
  }
}
// The file (and filled-in text) of a sign and of its plate.
const signArtOf = (x, seg) => {
  const file = signFile(x, seg);
  return { file, text: file === "B20a" ? String(x.v) : null };
};
const plateArtOf = (x, seg) => {
  const file = plateFile(x, seg);
  return file && { file, text: file === "E13" ? PLATES[x.plate] : null };
};
// All signs of the profiles, loaded before drawing (the row is drawn from the cache).
// Resolves to true when something new was loaded (the drawing then needs redrawing).
export async function loadSigns(...profiles) {
  const all = profiles.filter(Boolean).flatMap((p) => p.segments.flatMap((s) => (s.signs || []).map((x) => [x, s])));
  const todo = all.flatMap(([x, s]) => [signArtOf(x, s), plateArtOf(x, s)].filter(Boolean)).filter((a) => !signArt.has(signKey(a.file, a.text)));
  await Promise.all(todo.map((a) => loadSignFile(a.file, a.text)));
  return todo.length > 0;
}
const artFor = (a) => (a ? signArt.get(signKey(a.file, a.text)) : null);

// The row of signs under the labels (no head: the signs are what the data say, not always what is on the
// street; Bára): each part's signs under the part with their plates, and a sign shared by neighbouring parts
// once under a bracket over them. size: the height of a sign in drawing units; top: the top of the row; px:
// drawing units per screen pixel (for the bracket and the dot). A part too narrow for its signs gets a grey
// dot. Returns the bottom (top without signs).
export function layoutSigns(svg, size, top, px = size / 32) {
  const groups0 = [...svg.querySelectorAll("g.sign-group")];
  if (!groups0.length) return top;
  // All signs at one size (Bára): the size that lets every part's signs fit its width, but no smaller than
  // MIN_K of the full size; a part too narrow even for that shows a dot.
  const MIN_K = 0.6, gap = size * 0.12;
  const rowTop = top + 6 * px;
  const groups = groups0.map((g) => {
    const stacks = [...g.querySelectorAll("g.sign")];
    const ws = stacks.map((st) => Number(st.querySelector("image").dataset.u) * size);
    const need = ws.reduce((a, w) => a + w, 0) + gap * (ws.length - 1);
    return { g, stacks, ws, need, fit: (Number(g.dataset.w) * 0.94) / need };
  });
  const k = Math.min(1, ...groups.map((x) => x.fit).filter((f) => f >= MIN_K));
  const lineH = [0, 0];
  const bracket = 8 * px; // room for the bracket above shared signs
  const anyBracket = [0, 1].map((l) => groups0.some((g) => Number(g.dataset.line || 0) === l && g.querySelector("path.sign-bracket")));
  for (const { g, stacks, ws, need, fit } of groups) {
    const cx = Number(g.dataset.cx), line = Number(g.dataset.line || 0);
    const hidden = fit < MIN_K;
    for (const st of stacks) st.style.display = hidden ? "none" : "";
    let dot = g.querySelector("circle.sign-more");
    if (hidden) {
      // Not room for the signs: a dot, their names in the title (and in the editor).
      dot ??= el("circle", { class: "sign-more", fill: "#a8a397" }, g);
      dot.setAttribute("cx", cx); dot.setAttribute("r", 3 * px); dot.dataset.dy = 4 * px;
      dot.querySelector("title") || (el("title", {}, dot).textContent = stacks.map((st) => st.querySelector("title")?.textContent).join(", "));
      lineH[line] = Math.max(lineH[line], 8 * px);
      continue;
    }
    dot?.remove();
    // Every sign of the line one under the other's bracket room, so all stand on one line (Bára).
    const pad = anyBracket[line] ? bracket : 0;
    let x = cx - (need * k) / 2;
    stacks.forEach((st, j) => {
      let y = pad;
      const sw = ws[j] * k;
      for (const im of st.querySelectorAll("image")) {
        const ar = Number(im.dataset.ar);
        const plate = im.dataset.plate === "plate";
        // Every sign at one scale: a basic sign is size wide, a plate as wide as its sign.
        const w = plate ? sw : Number(im.dataset.u) * size * k, h = w / ar;
        im.setAttribute("x", x + (sw - w) / 2); im.dataset.dy = y;
        im.setAttribute("width", w); im.setAttribute("height", h);
        y += h + size * 0.04;
      }
      lineH[line] = Math.max(lineH[line], y);
      x += (ws[j] + gap) * k;
    });
  }
  // The second line (shared signs under parts that have their own) starts below the first.
  const lineTop = [rowTop, rowTop + (lineH[0] ? lineH[0] + size * 0.1 : 0)];
  for (const { g } of groups) {
    const t = lineTop[Number(g.dataset.line || 0)];
    for (const im of g.querySelectorAll("image")) im.setAttribute("y", t + Number(im.dataset.dy));
    const dot = g.querySelector("circle.sign-more");
    if (dot) dot.setAttribute("cy", t + Number(dot.dataset.dy));
    const br = g.querySelector("path.sign-bracket");
    if (br) {
      // A bracket over the parts a shared sign belongs to, the sign in its middle below.
      const a = Number(g.dataset.x0) + 6 * px, b = Number(g.dataset.x1) - 6 * px, y = t + 2 * px;
      br.setAttribute("d", `M${a} ${y + 5 * px} V${y} H${b} V${y + 5 * px}`);
      br.setAttribute("stroke-width", 1.2 * px);
    }
  }
  const rowH = lineH[1] ? lineTop[1] - rowTop + lineH[1] : lineH[0];
  return rowTop + rowH + size * 0.2;
}

function drawSigns(svg, profile, bounds) {
  const segs = profile.segments;
  const stack = (g, x, seg) => {
    const st = el("g", { class: "sign" }, g);
    const title = el("title", {}, st);
    title.textContent = signLabel(x) + (typeof x.v === "number" ? ` ${x.v} km/h` : "") + (x.plate ? ` (${PLATES[x.plate]})` : "");
    for (const [a, plate] of [[signArtOf(x, seg), false], [plateArtOf(x, seg), true]]) {
      const art = artFor(a);
      if (!art) continue;
      // A plate (dodatková tabulka) is drawn as wide as its sign, a second symbol (the bike under the bus) as a sign.
      // data-u: the sign's width in units of a basic sign (100 in its viewBox = 500 mm), so a square IP 4b and an
      // upright IP 11 are as wide as on the street (Bára).
      el("image", { href: art.uri, "data-ar": art.w / art.h, "data-u": art.w / 100, ...(plate ? { "data-plate": a.file === "C8a" ? "symbol" : "plate" } : {}) }, st);
    }
    if (!st.querySelector("image")) st.remove();
  };
  // A sign shared by neighbouring parts (the street's speed or zone under all its lanes) is drawn once, in the
  // middle of the run (Bára); signs of one part under it. Same sign = same file, value and plate as drawn.
  const id = (x, s) => JSON.stringify([signArtOf(x, s), plateArtOf(x, s)]);
  const ids = segs.map((s) => (s.signs || []).map((x) => id(x, s)));
  const shared = new Map(); // "i-j" → [[sign, seg]] for runs of 2 and more parts
  const own = segs.map((s) => [...(s.signs || [])]);
  for (let i = 0; i < segs.length; i++) {
    for (const x of [...own[i]]) {
      const key = id(x, segs[i]);
      let j = i;
      while (j + 1 < segs.length && ids[j + 1].includes(key)) j++;
      if (j === i) continue;
      const span = `${i}-${j}`;
      if (!shared.has(span)) shared.set(span, []);
      shared.get(span).push([x, segs[i]]);
      for (let m = i; m <= j; m++) own[m] = own[m].filter((y) => id(y, segs[m]) !== key);
    }
  }
  own.forEach((list, i) => {
    if (!list.length) return;
    const g = el("g", { class: "sign-group", "data-line": 0, "data-cx": (bounds[i] + bounds[i + 1]) / 2, "data-w": bounds[i + 1] - bounds[i] }, svg);
    list.forEach((x) => stack(g, x, segs[i]));
  });
  for (const [span, list] of shared) {
    const [i, j] = span.split("-").map(Number);
    // Below the parts' own signs when any of the run's parts has some.
    const line = own.slice(i, j + 1).some((l) => l.length) ? 1 : 0;
    const g = el("g", { class: "sign-group", "data-line": line, "data-cx": (bounds[i] + bounds[j + 1]) / 2, "data-w": bounds[j + 1] - bounds[i], "data-x0": bounds[i], "data-x1": bounds[j + 1] }, svg);
    el("path", { class: "sign-bracket", fill: "none", stroke: "#a8a397" }, g);
    list.forEach(([x, s]) => stack(g, x, s));
  }
  for (const g of svg.querySelectorAll("g.sign-group")) if (!g.querySelector("image")) g.remove();
}

export function buildSvg(profile, opts = {}) {
  const segs = profile.segments;
  const total = totalWidth(profile) * 100;
  const view = opts.view || [-EDGE, Math.max(total + 2 * EDGE, 2400)];
  const vx = view[0] - (view[1] - (total + 2 * EDGE)) / 2;
  // Tall buildings at the edges extend the drawing upwards.
  const tallest = Math.max(0, ...["left", "right"].map((k) =>
    edgeHeight(profile.edges?.[k], profile.edges?.[`${k}Info`], profile.edges?.[`${k}Style`])));
  // A tower beside a narrow street would squash the street into a strip: the view shows at most
  // TALL_SHARE of its width above the ground, and taller buildings are cut with a break line.
  const shown = Math.min(tallest, Math.max(1300, view[1] * TALL_SHARE));
  // The top row (total width, cut ends A/B) sits above the tallest building and its floor label.
  const y0 = Math.min(0, GROUND - shown - 140) - 110;
  labelTop = y0 + 190;
  // An export's title gets a band of its own above the top row (it covered the A of the cut's end).
  const yv = opts.title ? y0 - 130 : y0;
  // The bottom: the label rows, then the signs and the credits line of an export (set after the signs are laid out).
  let bottom = opts.credits ? H + 110 : H;
  const svg = el("svg", { xmlns: NS, viewBox: `${vx} ${yv} ${view[1]} ${bottom - yv}`, "font-family": "Inter, system-ui, sans-serif",
    role: "img", "aria-label": `Příčný profil, celkem ${fmt(total / 100)}: ` + segs.map((s) => `${TYPES[s.type]?.label || s.type} ${fmt(s.width)}`).join(", ") });
  const bg = el("rect", { class: "bg", x: vx, y: yv, width: view[1], height: bottom - yv, fill: "#fbfaf6" }, svg);

  const firstRaised = isRaised(segs[0]);
  const lastRaised = isRaised(segs.at(-1));
  drawEdge(svg, -EDGE, profile.edges?.left || "volno", "left", firstRaised ? GROUND - CURB : GROUND, profile.edges?.leftInfo, profile.edges?.leftStyle);
  drawEdge(svg, total, profile.edges?.right || "volno", "right", lastRaised ? GROUND - CURB : GROUND, profile.edges?.rightInfo, profile.edges?.rightStyle);

  let x = 0;
  const bounds = [0];
  segs.forEach((s, i) => {
    const t = TYPES[s.type] || TYPES.nezname;
    const w = s.width * 100;
    const top = isRaised(s) ? GROUND - CURB : GROUND;
    // Cars across the kerb (half_on_kerb): the half on the sidewalk side is raised (kerbLeft: the sidewalk is
    // on the left of the part).
    const half = s.type === "parkovani" && s.position === "half_on_kerb";
    const kerbLeft = half && (isRaised(segs[i - 1]) !== isRaised(segs[i + 1]) ? isRaised(segs[i - 1]) : x + w / 2 < total / 2);
    const g = el("g", { class: "seg" + (opts.selected === i ? " selected" : "") + (opts.changed?.has(i) ? " changed" : ""), "data-i": i }, svg);
    // Name and width on hover, also for parts too narrow for a label.
    el("title", {}, g).textContent = `${t.label}, ${fmt(s.width)}`;
    el("rect", { class: "ground", x, y: top, width: w, height: GROUND + 60 - top, fill: s.color || (s.position === "on_kerb" ? KERB_PAVING : t.color) }, g);
    if (half) {
      // The sidewalk half in the sidewalk's paving, with the kerb stone in the middle of the car.
      el("rect", { x: kerbLeft ? x : x + w / 2, y: GROUND - CURB, width: w / 2, height: CURB + 60, fill: KERB_PAVING }, g);
      el("rect", { x: x + w / 2 - (kerbLeft ? 12 : 0), y: GROUND - CURB, width: 12, height: CURB + 8, fill: "#c9c5ba", stroke: "#8d887c", "stroke-width": 1 }, g);
    }
    el("rect", { x, y: GROUND + 60, width: w, height: 40, fill: "#9b7f5f" }, g);
    el("rect", { x: x + 4, y: GROUND + 104, width: Math.max(w - 8, 1), height: 14, fill: SOURCES[s.source]?.color || "#999" }, g);
    const cx = x + w / 2;
    const forward = s.dir !== "backward";
    if (t.bed) drawTramBed(g, s, x, w, top, TYPES[segs[i - 1]?.type]?.bed, TYPES[segs[i + 1]?.type]?.bed);
    if (t.marked) {
      // A reserved tram lane: a wide solid line (25 cm) on the roadway where a part that is no tram lies beside.
      if (!TYPES[segs[i - 1]?.type]?.tracks) el("rect", { x: x + 4, y: top - 3, width: 25, height: 4, fill: "#f2f0ea" }, g);
      if (!TYPES[segs[i + 1]?.type]?.tracks) el("rect", { x: x + w - 29, y: top - 3, width: 25, height: 4, fill: "#f2f0ea" }, g);
    }
    if (t.tracks) {
      for (const dx of [-72, 72]) el("rect", { x: cx + dx - 6, y: top - 6, width: 12, height: 8, fill: "#3d3b36" }, g);
    }
    // Trees between the stalls (a tree item of a parking part, Bára): the tree stands behind the car, along the street.
    if (s.type === "parkovani") for (const it of s.items || []) if (it.kind === "strom") sprite(g, "tree", x + it.f * w, GROUND);
    if (t.sprite === "people" && t.withBike && w >= 140) {
      // Shared with cyclists: a walker and a cyclist side by side (only the cyclist when narrow).
      const bike = forward ? "biker-01-outbound" : "biker-01-inbound";
      if (w >= 240) {
        sprite(g, PEOPLE[(i * 2) % PEOPLE.length], x + w * 0.3, top);
        sprite(g, bike, x + w * 0.7, top);
      } else sprite(g, bike, cx, top);
    } else if (t.sprite === "people") {
      const n = w >= 300 ? 2 : w >= 140 ? 1 : 0;
      for (let k = 0; k < n; k++) sprite(g, PEOPLE[(i * 2 + k) % PEOPLE.length], x + (w * (k + 1)) / (n + 1), top, k % 2 === 1);
    } else if (s.type === "parkovani" && w >= (s.position ? 150 : 180)) {
      // Parked car drawn by orientation: front view (parallel), side view (perpendicular), angled.
      const right = cx > total / 2;
      const name = s.orient === "kolme" ? `car-sideways-${right ? "right" : "left"}`
        : s.orient === "sikme" ? `car-angled-front-${right ? "right" : "left"}`
        : laneDir(segs, i) === "backward" ? "car-inbound" : "car-outbound";
      if (half) {
        // Across the kerb: the car stands half a kerb up, tilted towards the roadway.
        // Higher on the sidewalk side, lower towards the roadway (SVG angles turn clockwise).
        const tilt = el("g", { transform: `rotate(${((kerbLeft ? 1 : -1) * Math.atan2(CURB, CAR_TRACK) * 180) / Math.PI} ${cx} ${GROUND - CURB / 2})` }, g);
        sprite(tilt, name, cx, GROUND - CURB / 2);
      } else sprite(g, name, cx, top);
    } else if (t.sprite === "car" && w >= 180 && s.trolley && cityArt() && CITY_ART[artKey()]?.["trolleybus-inbound"]) {
      // A lane only public transport may use (a zone with trolley wires): its trolleybus.
      sprite(g, `trolleybus-${forward ? "outbound" : "inbound"}`, cx, top);
    } else if (t.sprite === "car" && w >= 180) {
      sprite(g, forward ? "car-outbound" : "car-inbound", cx, top);
    } else if (t.sprite === "streetcar" && w >= 240) {
      tramSprite(g, forward ? "streetcar-outbound" : "streetcar-inbound", cx, top - 2);
    } else if (t.sprite === "bus" && w >= 250) {
      // Under trolley wires a trolleybus, where the city's illustrations have one (else the bus).
      const trolley = s.trolley && cityArt() && CITY_ART[artKey()]?.["trolleybus-inbound"];
      sprite(g, `${trolley ? "trolleybus" : "bus"}-${forward ? "outbound" : "inbound"}`, cx, top);
    } else if (t.sprite === "biker" && w >= 80) {
      sprite(g, forward ? "biker-01-outbound" : "biker-01-inbound", cx, top);
    } else if (t.sprite === "tree" && w >= 100) {
      sprite(g, "tree", cx, top);
    } else if (t.sprite === "bush" && w >= 100) {
      sprite(g, "bush", cx, top);
    } else if (t.sprite === "cafe" && w >= 150) {
      sprite(g, "cafe-seating-occupied", cx, top);
    }
    if (t.wall) el("rect", { x, y: top - 90, width: w, height: 90, fill: t.color }, g);
    for (const it of s.items || []) {
      if (it.kind === "strom" && s.type === "parkovani") continue; // drawn behind the car
      let ix = x + it.f * w, onRight = ix > total / 2;
      if (it.kind === "pristresek") {
        // A shelter opens towards the tram or bus beside its platform, its back wall at the platform's other edge,
        // by the cars (Bára, Jana Želivského).
        const transit = (n) => n && (TYPES[n.type]?.tracks || n.type === "bus" || n.type === "bus_cyklo");
        const toR = transit(segs[i + 1]), toL = transit(segs[i - 1]);
        if (toR !== toL) {
          onRight = toL;
          const half = Math.min(135, w / 2);
          ix = toR ? x + half : x + w - half;
        }
      }
      // A stop post at the platform's edge stays on the platform (it is 50 cm wide).
      if (it.kind === "oznacnik") ix = Math.min(Math.max(ix, x + 30), x + w - 30);
      drawItem(g, it.kind === "sloup_trakce" && it.center ? { ...it, reach: w / 2 } : it, ix, top, onRight);
    }
    el("text", { class: "lbl-w", "data-row": 0, "data-w": w, x: cx, y: GROUND + 170, "text-anchor": "middle", "font-size": 40, "font-weight": 600, fill: "#1f1f1d" }, g).textContent = fmt(s.width);
    let wrapped = false;
    if (w >= 80) {
      const contra = s.bikeDir && s.bikeDir !== (s.dir || "forward");
      let label = TYPES[s.type]?.tracks && s.withBus ? `${t.label} + BUS` + (t.directional && s.dir ? (forward ? " ↑" : " ↓") : "")
        : s.type === "parkovani" && s.use ? `Parkování ${PARKING_USE[s.use]}`
        // Under a narrow part "Napůl na chodníku" alone (the long name would not fit on two lines).
        : s.type === "parkovani" && s.position ? (s.position === "half_on_kerb" && w < 300 ? "Napůl na chodníku" : `Parkování ${PARKING_POSITION[s.position]}`)
        : s.type === "parkovani" && s.orient ? `Parkování ${ORIENT_LABEL[s.orient]}`
        // A lane with a piktokoridor is first a lane (Bára): "Jízdní pruh ↑, piktokoridor ↓" with the cyclists' direction
        // when it differs; cyclists in contraflow in a plain lane likewise.
        : s.type === "pruh_piktokoridor" ? `${TYPES.pruh.label}${s.dir ? (forward ? " ↑" : " ↓") : ""}, piktokoridor${contra ? (s.bikeDir === "backward" ? " ↓" : " ↑") : ""}`
        : t.label + (t.directional && s.dir ? (forward ? " ↑" : " ↓") : s.type === "pruh" ? " ↑↓" : "") +
          (contra ? `, cyklisté ${s.bikeDir === "backward" ? "↓" : "↑"}` : "");
      // Trees between the stalls are named with the parking (Bára).
      if (s.type === "parkovani" && s.items?.some((it) => it.kind === "strom")) label += " se stromy";
      const name = el("text", { class: "lbl-t", "data-row": 1, "data-w": w, "data-full": label, x: cx, y: GROUND + 215, "text-anchor": "middle", "font-size": 28, fill: "#4f4e49" }, g);
      const lines = twoLines(label);
      if (label.length * 0.56 * 28 > w && lines) {
        // A long name under a narrow part goes on two lines (the page refits it to the screen).
        lines.forEach((line, j) => { el("tspan", { x: cx, dy: j ? "1.15em" : "0" }, name).textContent = line; });
        wrapped = true;
      } else name.textContent = label;
    }
    if (s.turn) {
      el("text", { class: "lbl-t lbl-turn", "data-row": 2, "data-w": w, x: cx, y: GROUND + (wrapped ? 290 : 255), "text-anchor": "middle", "font-size": 28, fill: "#185fa5" }, g).textContent = turnLabel(s.turn);
    }
    if (t.sharrow || s.bikeDir || t.bike) {
      // Cyclist sharing the lane (with a painted pictogram on a piktokoridor), possibly in contraflow.
      const bikeFwd = (s.bikeDir || s.dir) !== "backward";
      if (t.sharrow) el("rect", { x: cx - 60, y: top - 4, width: 120, height: 6, fill: "#f2f0ea" }, g);
      sprite(g, bikeFwd ? "biker-01-outbound" : "biker-01-inbound", x + Math.min(w * 0.2, 60) + 20, top);
    }
    if (opts.onSelect) {
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", `${t.label}, ${fmt(s.width)}, ${SOURCES[s.source]?.label || ""}`);
      g.addEventListener("click", () => opts.onSelect(i));
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opts.onSelect(i); } });
    }
    x += w;
    bounds.push(x);
  });

  el("text", { class: "lbl-total top-row", x: total / 2, y: y0 + 70, "text-anchor": "middle", "font-size": 46, "font-weight": 600, fill: "#1f1f1d" }, svg).textContent =
    `Celkem ${fmt(total / 100)}`;
  // Ends of the cut, lettered as on the map (A = left end, B = right end), above everything else.
  // On a narrow street A and B step aside so the total does not run into them (the page redoes
  // this at screen size in layoutTop, an export keeps it).
  const half = (`Celkem ${fmt(total / 100)}`.length * 0.56 * 46) / 2;
  const ends = [Math.min(0, total / 2 - half - 70), Math.max(total, total / 2 + half + 70)];
  for (const [letter, x] of [["A", ends[0]], ["B", ends[1]]]) {
    el("circle", { class: "top-row", cx: x, cy: y0 + 70, r: 52, fill: "#d8413f", stroke: "#fff", "stroke-width": 8 }, svg);
    el("text", { class: "top-row", x, y: y0 + 94, "text-anchor": "middle", "font-size": 68, "font-weight": 700, fill: "#fff" }, svg).textContent = letter;
  }

  // Trolley wires over the lanes under them (OSM trolley_wire): a span wire across, from the first wired lane
  // to the last, and the two contact wires (0.6 m apart, 5.4 m above the road) over each lane, hung from it.
  const wired = segs.map((s, i) => (s.wires ? i : -1)).filter((i) => i >= 0);
  if (wired.length) {
    const wg = el("g", { class: "trolley-wires" }, svg);
    const yContact = GROUND - WIRE_H, ySpan = GROUND - WIRE_H - 60;
    el("line", { x1: bounds[wired[0]] + 20, x2: bounds[wired.at(-1) + 1] - 20, y1: ySpan, y2: ySpan, stroke: "#4a4945", "stroke-width": 2.5 }, wg);
    for (const i of wired) {
      const cx = (bounds[i] + bounds[i + 1]) / 2;
      for (const dx of [-30, 30]) {
        el("line", { x1: cx + dx, x2: cx + dx, y1: ySpan, y2: yContact, stroke: "#4a4945", "stroke-width": 1.5 }, wg);
        el("circle", { cx: cx + dx, cy: yContact, r: 5, fill: "#2b2a27" }, wg);
      }
    }
  }

  if (opts.title) {
    // A title tag in the top left corner, over the building there.
    el("rect", { class: "title-bg", x: vx + 16, y: yv + 30, width: 60 + opts.title.length * 25, height: 80, rx: 16, fill: "#1d1d1b" }, svg);
    el("text", { class: "lbl-title", x: vx + 46, y: yv + 86, "font-size": 46, "font-weight": 700, fill: "#fff" }, svg).textContent = opts.title;
  }

  if (opts.editable) {
    bounds.forEach((bx, k) => {
      const h = el("g", { class: "handle", "data-k": k }, svg);
      el("line", { x1: bx, x2: bx, y1: GROUND - 300, y2: GROUND + 120, stroke: "#8a877e", "stroke-width": 2, "stroke-dasharray": "8 6" }, h);
      el("rect", { class: "grab", x: bx - 40, y: GROUND - 340, width: 80, height: 460, fill: "transparent" }, h);
      el("circle", { class: "knob", cx: bx, cy: GROUND - 300, r: 18, fill: "#fff", stroke: "#185fa5", "stroke-width": 5 }, h);
      el("path", { class: "knob", d: `M${bx - 8} ${GROUND - 300} h16 M${bx - 8} ${GROUND - 300} l5 -5 M${bx - 8} ${GROUND - 300} l5 5 M${bx + 8} ${GROUND - 300} l-5 -5 M${bx + 8} ${GROUND - 300} l-5 5`, stroke: "#185fa5", "stroke-width": 3, fill: "none" }, h);
    });
  }
  if (opts.signs !== false) {
    drawSigns(svg, profile, bounds);
    // Without the page's fitting (an export): the rows below the labels at a fixed size, the picture as tall
    // as they need.
    const end = layoutSigns(svg, SIGN_SIZE, GROUND + 320, 3.6);
    if (end > GROUND + 320) bottom += end - H + 20;
  }
  if (opts.credits) {
    // Exported pictures carry the attribution their sources require (CC BY-SA for the illustrations): the
    // lines of exportCredits (or the given ones), each broken at " · " to the picture's width, the picture
    // made as tall as they need.
    const FS = 24, LH = 32, fit = Math.max(40, Math.floor((view[1] - 60) / (FS * 0.52)));
    const rows = [];
    for (const line of Array.isArray(opts.credits) ? opts.credits : exportCredits()) {
      // Pieces with the separator before them; a part too long for a row breaks after its commas.
      const pieces = line.split(" · ").flatMap((part, i) => (part.length > fit ? part.split(/(?<=,) /) : [part])
        .map((t, j) => [j ? " " : i ? " · " : "", t]));
      let row = "";
      for (const [sep, t] of pieces) {
        if (row && row.length + sep.length + t.length > fit) { rows.push(row); row = t; } else row += row ? sep + t : t;
      }
      if (row) rows.push(row);
    }
    bottom += (rows.length - 1) * LH;
    rows.forEach((row, i) => {
      el("text", { class: "credits", x: vx + 30, y: bottom - 25 - (rows.length - 1 - i) * LH, "font-size": FS, fill: "#6b6a65" }, svg).textContent = row;
    });
  }
  svg.setAttribute("viewBox", `${vx} ${yv} ${view[1]} ${bottom - yv}`);
  bg.setAttribute("height", bottom - yv);
  svg.dataset.view = JSON.stringify(view);
  return svg;
}

// Narrowest width a segment can be dragged to: perpendicular parking keeps 4.5 m (ČSN 73 6056).
const minWidth = (seg) => (seg.type === "parkovani" && seg.orient === "kolme" ? 4.5 : 0.2);

// Mount an editable profile with draggable boundaries.
// onRedraw runs after each drawing (also while a handle is dragged), for the page to fit the labels.
export function mountEditor(container, profile, { editable = true, selected, onSelect, onChange, onRedraw }) {
  const draw = (view) => {
    container.replaceChildren(buildSvg(profile, { editable, selected, onSelect, view }));
    onRedraw?.(container);
    return container.firstChild;
  };
  let svg = draw();
  svg.addEventListener("pointerdown", startDrag);

  function startDrag(ev) {
    const h = ev.target.closest(".handle");
    if (!h) return;
    ev.preventDefault();
    const k = Number(h.dataset.k);
    const view = JSON.parse(svg.dataset.view);
    const toCm = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse()).x;
    };
    let last = toCm(ev);
    const segs = profile.segments;
    const move = (e) => {
      const xcm = toCm(e);
      let d = Math.round((xcm - last) / 5) * 0.05; // 5 cm steps
      if (!d) return;
      const a = segs[k - 1], b = segs[k];
      if (a && b) {
        d = Math.max(-(a.width - minWidth(a)), Math.min(b.width - minWidth(b), d));
        a.width = +(a.width + d).toFixed(2);
        b.width = +(b.width - d).toFixed(2);
        a.source = b.source = "user";
      } else if (b) {
        d = Math.min(b.width - minWidth(b), d);
        b.width = +(b.width - d).toFixed(2);
        b.source = "user";
      } else if (a) {
        d = Math.max(-(a.width - minWidth(a)), d);
        a.width = +(a.width + d).toFixed(2);
        a.source = "user";
      }
      last += d * 100;
      svg = draw(view);
      svg.addEventListener("pointerdown", startDrag);
    };
    // A cancelled touch (the browser took the gesture) ends the drag like lifting the finger.
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      onChange();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }
}

export function svgString(svgs, gap = 40) {
  if (svgs.length === 1) return new XMLSerializer().serializeToString(svgs[0]);
  // Stack several profiles vertically into one SVG.
  const boxes = svgs.map((s) => s.getAttribute("viewBox").split(" ").map(Number));
  const width = Math.max(...boxes.map((b) => b[2]));
  const height = boxes.reduce((a, b) => a + b[3] + gap, -gap);
  const out = el("svg", { xmlns: NS, viewBox: `0 0 ${width} ${height}` });
  let y = 0;
  svgs.forEach((s, i) => {
    const b = boxes[i];
    const inner = s.cloneNode(true);
    inner.setAttribute("x", (width - b[2]) / 2);
    inner.setAttribute("y", y);
    inner.setAttribute("width", b[2]);
    inner.setAttribute("height", b[3]);
    out.appendChild(inner);
    y += b[3] + gap;
  });
  return new XMLSerializer().serializeToString(out);
}

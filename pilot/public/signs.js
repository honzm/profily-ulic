// The row of traffic signs under the profile (Bára 10. 11. 2026): what the street's OSM tags and the profile's
// parts say about the traffic regime, as signs of vyhláška 294/2015 Sb. (files in znacky/).
// A sign is { k, v?, plate? }: k is the key of a sign, or of a regime whose sign depends on the direction of
// view (oneway: IP 4b when the traffic goes away from the viewer, B 2 when it comes towards them), so that
// "Otočit" needs no change of the data. Every sign stands under the part it belongs to (seg.signs), at most
// MAX_PER_PART per part; rules of the whole street (speed, one-way, zones) under its driving lanes (Bára).
export const MAX_PER_PART = 2;

// Labels for the palette in Návrh and for the title of each drawn sign.
export const SIGNS = {
  b1: "B 1 Zákaz vjezdu všech vozidel",
  b11: "B 11 Zákaz vjezdu všech motorových vozidel",
  b8: "B 8 Zákaz vjezdu jízdních kol",
  b30: "B 30 Zákaz vstupu chodců",
  b20a: "B 20a Nejvyšší dovolená rychlost",
  b28: "B 28 Zákaz zastavení",
  b29: "B 29 Zákaz stání",
  oneway: "IP 4b / B 2 Jednosměrný provoz",
  ip4c: "IP 4c / B 2 Jednosměrný provoz s protisměrným provozem cyklistů",
  c8a: "C 8a Stezka pro cyklisty",
  c9a: "C 9a Stezka pro chodce a cyklisty",
  c10a: "C 10a Stezka pro chodce a cyklisty dělená",
  ip11a: "IP 11a–c Parkoviště",
  ip11d: "IP 11d Parkoviště (stání na chodníku kolmé nebo šikmé)",
  ip11e: "IP 11e Parkoviště (stání na chodníku podélné)",
  ip11f: "IP 11f Parkoviště (částečné stání na chodníku kolmé nebo šikmé)",
  ip11g: "IP 11g Parkoviště (částečné stání na chodníku podélné)",
  ip12: "IP 12 Vyhrazené parkoviště",
  ztp: "IP 12 + O 1 Parkoviště pro ZTP",
  ip14a: "IZ 1a Dálnice",
  ip15a: "IZ 2a Silnice pro motorová vozidla",
  ip20a: "IP 20a Vyhrazený jízdní pruh BUS",
  zona30: "IZ 8a Zóna 30",
  ip26a: "IZ 5a Obytná zóna",
  ip27a: "IZ 6a Pěší zóna",
  cyklozona: "IZ 9a Zóna pro cyklisty",
};
export function normalizeSign(x = {}) {
  if (!x || typeof x !== "object") return { k: "oneway" };
  if (x.k === "ip4c" || (x.k === "oneway" && x.plate === "protismer")) return { k: "ip4c" };
  if (x.k === "oneway") return { k: "oneway" };
  return { k: x.k };
}
// Dodatkové tabulky (plate) of a sign: text of E 13, or a key of a pictogram.
export const PLATES = { kola: "s cyklisty", kolo: "i pro cyklisty", protismer: "cyklisté v protisměru", obsluha: "Mimo dopravní obsluhy", podelne: "podélné", kolme: "kolmé", sikme: "šikmé" };
// Signs the palette offers with a plate, as signs of their own: one-way with contraflow cyclists is IP 4c (B 2 +
// E 12b when the lane comes towards the viewer), not IP 4b with a plate (a user, 11. 11. 2026).
export const SIGN_CHOICES = { "oneway+protismer": { k: "oneway", plate: "protismer", label: "IP 4c / B 2 + E 12b Jednosměrný provoz, cyklisté v protisměru" } };
// The label of a sign in Návrh and in the title of a drawn sign. Legacy one-way+protismer data is normalized to the
// canonical IP 4c sign so the UI and loaded profiles stay consistent.
export function signLabel(x = {}) {
  const y = normalizeSign(x);
  if (y.k === "ip4c") return SIGNS.ip4c;
  if (y.k === "oneway") return SIGNS.oneway;
  return SIGNS[y.k] || String(y.k || "");
}

const ROAD = new Set(["pruh", "pruh_piktokoridor", "bus", "bus_cyklo", "tramvaj_v_pruhu", "obsluzna"]);
const CARRIAGEWAY = new Set([...ROAD, "parkovani", "cyklopruh", "ochranny_pruh", "krajnice", "tramvaj"]);
const yes = (v) => ["yes", "designated", "permissive"].includes(v);
const num = (v) => { const m = /^(\d+)/.exec(String(v ?? "")); return m ? Number(m[1]) : undefined; };

// The speed that the zone sign already says (no B 20a of its own).
const ZONE_SPEED = { ip26a: 20, ip27a: 20, zona30: 30, cyklozona: 30 };

// The rules of the street that belong to its driving lanes (Bára: no signs for the whole profile; speed and
// one-way under the lanes they concern), in order of importance: the kind of road or zone, an entry ban.
export function streetSigns(tags = {}) {
  const z = [];
  const hw = tags.highway;
  const zone = String(tags["zone:traffic"] || tags["zone:maxspeed"] || tags["maxspeed:type"] || "");
  if (hw === "motorway" || hw === "motorway_link") z.push({ k: "ip14a" });
  else if (tags.motorroad === "yes") z.push({ k: "ip15a" });
  if (hw === "living_street") z.push({ k: "ip26a" });
  else if (hw === "pedestrian") z.push(yes(tags.bicycle) ? { k: "ip27a", plate: "kola" } : { k: "ip27a" });
  else if (tags.cyclestreet === "yes" || tags.bicycle_road === "yes") z.push({ k: "cyklozona" });
  else if (/zone:?30$|:30$/.test(zone) && !/rural|urban$/.test(zone)) z.push({ k: "zona30" });
  // Entry bans of the whole street, with the exception of local traffic (destination).
  const ban = (v) => v === "no" || v === "destination" || v === "private";
  if (ban(tags.access) || ban(tags.vehicle)) z.push({ k: "b1", ...((tags.access || tags.vehicle) === "destination" ? { plate: "obsluha" } : {}) });
  else if (ban(tags.motor_vehicle)) z.push({ k: "b11", ...(tags.motor_vehicle === "destination" ? { plate: "obsluha" } : {}) });
  return z;
}
// The street's speed limit unless a zone sign says it, or it is the town's default 50 without a sign.
function streetSpeed(tags, zones) {
  const speed = num(tags.maxspeed);
  const zoned = zones.find((s) => ZONE_SPEED[s.k]);
  if (!speed || (zoned && ZONE_SPEED[zoned.k] === speed)) return undefined;
  if (speed === 50 && !/sign/.test(String(tags["source:maxspeed"] || "")) && !tags.traffic_sign) return undefined;
  return speed;
}

// Signs of the parts of a derived profile (segments from the viewer's left to right), at most MAX_PER_PART each.
export function deriveSigns(profile, tags = {}, ctx = {}) {
  const segs = profile.segments;
  const rules = streetSigns(tags);
  const road = segs.map((s, i) => (ROAD.has(s.type) ? i : -1)).filter((i) => i >= 0);
  const lanes = road.filter((i) => segs[i].type !== "obsluzna");
  // One-way: all the lanes go one way; contraflow cyclists when OSM opens it (oneway:bicycle=no) or a part
  // carries cyclists against the cars. The sign follows the lane's direction when drawn (signFile).
  const dirs = new Set(lanes.map((i) => segs[i].dir || "forward"));
  const oneway = lanes.length && ["yes", "1", "true", "-1"].includes(tags.oneway) && dirs.size === 1;
  const contra = oneway && (tags["oneway:bicycle"] === "no" || segs.some((s) => s.bikeDir && s.bikeDir !== [...dirs][0]));
  const lanesSpeed = String(tags["maxspeed:lanes"] || "").split("|").map(num);
  const speed = streetSpeed(tags, rules);
  segs.forEach((s, i) => {
    const out = [];
    const t = s.type;
    // Under the lane only the round bus symbol of IP 20a (Bára).
    // In a bus and bike lane the blue bike symbol stands under it (Bára).
    if (t === "bus" || t === "bus_cyklo") out.push({ k: "ip20a", ...(t === "bus_cyklo" ? { plate: "kolo" } : {}) });
    // Road markings (cycle lanes, piktokoridor, tram lane, turn arrows) are in the drawing itself (Bára).
    else if (t === "cyklostezka") out.push({ k: "c8a" });
    else if (t === "stezka_sdilena") out.push({ k: tags.segregated === "yes" ? "c10a" : "c9a" });
    else if (t === "parkovani" && s.source !== "odhad") {
      if (s.use === "ztp") out.push({ k: "ztp" });
      else if (s.use) out.push({ k: "ip12" });
      // Cars on the sidewalk (IP 11d, e) or partly on it (IP 11f, g): parallel, or perpendicular and oblique.
      else if (s.position) {
        const along = (s.orient || "podelne") === "podelne";
        out.push({ k: s.position === "on_kerb" ? (along ? "ip11e" : "ip11d") : along ? "ip11g" : "ip11f" });
      } else out.push({ k: "ip11a", ...(s.orient ? { plate: s.orient } : {}) });
    }
    if (lanes.includes(i)) {
      if (oneway) out.push(contra ? { k: "ip4c" } : { k: "oneway" });
      // Speed per lane (maxspeed:lanes counts the lanes from the left in the way's direction), per direction,
      // or of the street; a zone sign says its own speed.
      const forward = lanes.filter((j) => (segs[j].dir || "forward") === "forward");
      const v = lanesSpeed.length === lanes.length && forward.length === lanes.length ? lanesSpeed[lanes.indexOf(i)]
        : num(tags[(s.dir || "forward") === "forward" ? "maxspeed:forward" : "maxspeed:backward"]) ?? speed;
      if (v) out.push({ k: "b20a", v });
      out.push(...rules);
    }
    if (out.length) s.signs = out.slice(0, MAX_PER_PART);
  });
  // No parking / no stopping on a kerb: on the outermost lane of that side (parking:<side>:restriction=
  // no_stopping|no_parking). The way's right is the profile's right when the profile looks along the way
  // (ctx.alongWay), else its left. It takes the place of the lane's last sign.
  for (const side of ["left", "right"]) {
    const r = tags[`parking:${side}:restriction`] || tags["parking:both:restriction"];
    const k = r === "no_stopping" ? "b28" : r === "no_parking" ? "b29" : null;
    if (!k || !lanes.length) continue;
    const profileRight = (side === "right") === (ctx.alongWay !== false);
    const s = segs[profileRight ? lanes.at(-1) : lanes[0]];
    const list = (s.signs || []).filter((x) => x.k !== k);
    s.signs = [...list.slice(0, MAX_PER_PART - 1), { k }];
  }
  delete profile.zones;
  return profile;
}

// The file of a sign as drawn for a viewer, and its value: oneway becomes IP 4b or B 2 by the direction of
// the lanes (forward = away from the viewer).
// seg: the part the sign stands under (a one-way sign follows its lane's direction).
export function signFile(s, seg) {
  const dir = s.dir ?? seg?.dir;
  const contra = s.k === "ip4c" || (s.k === "oneway" && s.plate === "protismer");
  // IP 4c (vyhl. 205/2025): one-way with contraflow cyclists, in place of IP 4b + E 12a.
  if (s.k === "oneway" || s.k === "ip4c") return dir === "backward" ? "B2" : contra ? "IP4c" : "IP4b";
  // Oblique stalls have the sign of perpendicular ones (IP 11b, Bára).
  if (s.k === "ip11a") return s.plate === "podelne" ? "IP11c" : s.plate ? "IP11b" : "IP11a";
  if (s.k === "ip27a" && s.plate === "kola") return "IZ6a-kola";
  if (s.k === "b20a") return [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130].includes(s.v) ? `B20a-${s.v}` : "B20a";
  return { b1: "B1", b2: "B2", b8: "B8", b11: "B11", b28: "B28", b29: "B29", b30: "B30", c8a: "C8a", c9a: "C9a", c10a: "C10a",
    ip11d: "IP11d", ip11e: "IP11e", ip11f: "IP11f", ip11g: "IP11g",
    ip12: "IP12", ztp: "IP12-ztp", ip14a: "IZ1a", ip15a: "IZ2a", ip20a: "IP20a-symbol", zona30: "IZ8a-30",
    ip26a: "IZ5a", ip27a: "IZ6a", cyklozona: "IZ9a" }[s.k] || s.k;
}
// The plate under a sign: contraflow cyclists are E 12a under IP 4b and E 12b under B 2; E 13 carries a text.
export function plateFile(s, seg) {
  if (s.k === "ip4c" || s.plate === "protismer") return (s.dir ?? seg?.dir) === "backward" ? "E12b" : null; // IP 4c says it itself
  if (s.plate === "obsluha") return "E13";
  if (s.plate === "kolo") return "C8a"; // the round bike symbol under the bus of IP 20a
  return null;
}


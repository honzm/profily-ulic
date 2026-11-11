// Rules of 11/2026 (evaluation/pravidla-11-2026/ZPRAVA.md): parked cars estimated by the law, three kinds of
// tram, driving lanes by the class of the street (Prague's TSK).
import { test } from "node:test";
import assert from "node:assert/strict";
import { localFrame, deriveProfile, techLines, classGroup } from "../pilot/public/derive.js";
import { checkRules } from "../pilot/public/rules.js";
import { cleanProfile } from "../pilot/public/validate.js";
import { packProfile, unpackProfile } from "../pilot/public/share.js";
import { toStreetmix } from "../pilot/public/streetmix.js";
import { bedOrtho, bedPixels, classifyBed, sleeperRepeat, tramOffsets } from "../pilot/public/ortho.js";
import { deflateSync } from "node:zlib";

// A street running north; the cut runs west–east through y = 0 (t = −x). Houses, sidewalks of 3 m, and
// between them what `middle` lists as [code, width] from west to east.
const frame = localFrame(50.08, 14.42);
const rect = (code, x0, x1) => ({ code, label: "", rings: [[[x0, -60], [x1, -60], [x1, 60], [x0, 60]]], bbox: [x0, -60, x1, 60] });
const ll = (x, y) => { const [lon, lat] = frame.toLonLat(x, y); return { lon, lat }; };
const line = (x) => [ll(x, -60), ll(x, 60)];
function street(middle, tags, { extra = [], lines = [], axis = 0, ortho } = {}) {
  const total = middle.reduce((a, [, w]) => a + w, 0);
  let x = -total / 2;
  const polys = [rect(601, x - 8, x - 3), rect(702, x - 3, x)];
  for (const [code, w] of middle) { polys.push(rect(code, x, x + w)); x += w; }
  polys.push(rect(702, x, x + 3), rect(601, x + 3, x + 8));
  const way = { type: "way", id: 1, tags: { highway: "residential", ...tags }, geometry: line(axis) };
  return deriveProfile({ center: [0, 0], dir: [0, 1], half: 40, polys, osm: { elements: [way, ...extra] }, frame, way, inZps: false, lines, ortho });
}
const road = (w, tags, opts) => street([[701, w]], tags, opts);
const guessed = (p) => p.segments.filter((s) => s.type === "parkovani" && s.source === "odhad").length;
const lanes = (p) => p.segments.filter((s) => s.type === "pruh");

test("odhad stání podle zákona: obousměrka od 8 m na jedné straně, od 10 m na obou", () => {
  assert.equal(guessed(road(4.85, {})), 0, "Smetanova v České Třebové, 4,85 m");
  assert.equal(guessed(road(7, {})), 0, "Jiráskova, 7 m");
  assert.equal(guessed(road(7.9, {})), 0);
  assert.equal(guessed(road(8, {})), 1);
  assert.equal(guessed(road(9.9, {})), 1);
  assert.equal(guessed(road(10, {})), 2);
  // The lanes beside keep 3 m each (no shared lane of 2.5 m any more).
  for (const w of [8, 9, 10, 12]) assert.ok(lanes(road(w, {})).every((s) => s.width >= 3 - 1e-9), `${w} m`);
});

test("odhad stání podle zákona: jednosměrka od 5 m na jedné straně, od 7 m na obou", () => {
  assert.equal(guessed(road(4.9, { oneway: "yes" })), 0);
  assert.equal(guessed(road(5, { oneway: "yes" })), 1);
  assert.equal(guessed(road(6.9, { oneway: "yes" })), 1);
  assert.equal(guessed(road(7, { oneway: "yes" })), 2);
  assert.ok(lanes(road(5, { oneway: "yes" })).every((s) => s.width >= 3 - 1e-9));
});

test("odhad stání: v zástavbě chodník u obruby nerozhoduje, zakázané stání a placená zóna platí dál", () => {
  // Green and no sidewalk at the curb.
  const p = street([[400, 4], [701, 10], [400, 4]], {});
  assert.equal(guessed(p), 2);
  assert.equal(guessed(road(10, { "parking:both": "no" })), 0);
  assert.equal(guessed(road(10, { highway: "tertiary" })), 0, "jen místní ulice");
});

test("odhad stání: mimo zástavbu jen u obruby s chodníkem, v obytné zóně vůbec", () => {
  // A road of 10 m between fields (green to 30 m on each side), no building near: no estimate.
  const field = (west, east, tags = {}, extra = []) => {
    const polys = [];
    let x = -5;
    for (const [code, w] of [...west].reverse()) { polys.push(rect(code, x - w, x)); x -= w; }
    polys.push(rect(701, -5, 5));
    x = 5;
    for (const [code, w] of east) { polys.push(rect(code, x, x + w)); x += w; }
    const way = { type: "way", id: 1, tags: { highway: "residential", ...tags }, geometry: line(0) };
    return deriveProfile({ center: [0, 0], dir: [0, 1], half: 40, polys, osm: { elements: [way, ...extra] }, frame, way, inZps: false });
  };
  const green = [[400, 30]];
  assert.equal(guessed(field(green, green)), 0, "silnice mezi poli");
  // A sidewalk behind a green strip of 3 m on one side: the estimate there (Ostrava Betonářská).
  assert.equal(guessed(field(green, [[400, 3], [702, 2], [400, 25]])), 1);
  // OSM's sidewalk tags count too.
  assert.equal(guessed(field(green, green, { sidewalk: "both" })), 2);
  // A house of OSM 15 m from the kerb (village street): built-up, the estimate by the law stays on that side.
  const house = { type: "area", id: 5, tags: { building: "house" }, geometry: [ll(20, -5), ll(28, -5), ll(28, 5), ll(20, 5), ll(20, -5)] };
  assert.equal(guessed(field(green, green, {}, [house])), 1);
  // A house of the surfaces 30 m out counts, one 45 m out does not.
  assert.equal(guessed(field(green, [[400, 30], [601, 8]])), 1);
  assert.equal(guessed(field(green, [[400, 45], [601, 8]])), 0);
  // Residential zone (§ 39): parking only in marked places, so no estimate; OSM's tagged parking stays.
  assert.equal(guessed(road(10, { highway: "living_street" })), 0);
  const tagged = road(10, { highway: "living_street", "parking:both": "lane" });
  assert.equal(tagged.segments.filter((x) => x.type === "parkovani" && x.source !== "odhad").length, 2);
});

test("odhad stání u tramvaje: od kolejnice 3,5 m", () => {
  // Two tracks 3 m apart in the middle: rails 0.72 m beside the axes.
  const tram = (x) => ({ type: "way", id: 10 + x, tags: { railway: "tram" }, geometry: line(x) });
  const withTracks = (w) => road(w, { embedded_rails: "tram" }, { extra: [tram(-1.5), tram(1.5)] });
  assert.equal(guessed(withTracks(14)), 0, "obruba 4,8 m od kolejnice");
  assert.equal(guessed(withTracks(16)), 2, "obruba 5,8 m od kolejnice");
});

test("tři druhy tramvaje: vyhrazený pruh, tramvaj v pruhu, samostatné těleso", () => {
  const tram = (x, tags = {}) => ({ type: "way", id: 20 + x, tags: { railway: "tram", ...tags }, geometry: line(x) });
  const tracks = [tram(-1.5), tram(1.5)];
  const types = (p) => p.segments.map((s) => s.type);
  // Spálená: embedded_rails, lanes:forward=1 + lanes:backward=1 fit beside the tracks.
  const spalena = road(13, { embedded_rails: "tram", "lanes:forward": "1", "lanes:backward": "1", highway: "tertiary" }, { extra: tracks });
  assert.deepEqual(types(spalena).filter((t) => t.startsWith("tramvaj")), ["tramvaj_pruh", "tramvaj_pruh"]);
  assert.equal(types(spalena).filter((t) => t === "pruh").length, 2);
  // OSM counts no lanes: the tram shares the lane with the cars.
  const shared = road(9, { embedded_rails: "tram", highway: "tertiary" }, { extra: tracks });
  assert.ok(types(shared).every((t) => t !== "tramvaj_pruh" && t !== "tramvaj"));
  assert.ok(types(shared).includes("tramvaj_v_pruhu"));
  // MTVU 705 between two roadways: a raised bed; 7 m wide without a surface in OSM: gravel, as an estimate.
  const bed = street([[701, 6.5], [705, 7], [701, 6.5]], { highway: "tertiary" }, { extra: tracks });
  const beds = bed.segments.filter((s) => s.type === "tramvaj");
  assert.equal(beds.length, 2);
  assert.ok(beds.every((s) => s.bed === "strk" && s.bedGuess));
  // Tracks through a green area: a bed of grass. Buses on the track (psv=yes): a part for trams and buses.
  const grass = street([[701, 6.5], [400, 7], [701, 6.5]], { highway: "tertiary" }, { extra: [tram(-1.5, { psv: "yes" }), tram(1.5)], axis: 6.75 });
  const g = grass.segments.filter((s) => s.type === "tramvaj");
  assert.deepEqual(g.map((s) => s.bed), ["trava", "trava"]);
  assert.equal(g.filter((s) => s.withBus).length, 1);
});

test("druh tramvaje projde kontrolou uloženého profilu", () => {
  const p = cleanProfile({ segments: [{ type: "tramvaj", width: 3.5, bed: "strk", withBus: true }, { type: "tramvaj", width: 3.5, bed: "beton" }, { type: "tramvaj_pruh", width: 3, withBus: "ano" }] });
  assert.equal(p.segments[0].bed, "strk");
  assert.equal(p.segments[0].withBus, true);
  assert.equal(p.segments[1].bed, undefined);
  assert.equal(p.segments[2].withBus, undefined);
});

test("třída TSK: skupina ČSN 73 6110 pro varování o šířce pruhu", () => {
  assert.equal(classGroup({ mk: 1 }), "mk1");
  assert.equal(classGroup({ mk: 0, road: 2 }), "sil2");
  assert.equal(classGroup({ motorway: 1, mk: 1 }), "dalnice");
  assert.equal(classGroup({ mk: 0, road: 0 }), null);
  const lvl = (width, roadClass) => checkRules({ segments: [{ type: "pruh", width, roadClass }] }).map((f) => f.level).join();
  assert.equal(lvl(2.9, "mk1"), "min", "sběrná: pod 3 m");
  assert.equal(lvl(3, "mk2"), "");
  assert.equal(lvl(2.9, "mk3"), "zaklad", "obslužná: 2,75–3 m");
  assert.equal(lvl(2.7, "mk3"), "min");
  assert.equal(lvl(2.6, "mk4"), "zaklad", "zklidněná: 2,5–2,75 m");
  assert.equal(lvl(3.25, "dalnice"), "zaklad", "dálnice: 3,5 m");
  assert.equal(lvl(2.9, undefined), "zaklad", "bez třídy jako dřív");
  assert.equal(lvl(2.4, undefined), "min");
  // A lane added in the design takes the class of the street's other lanes.
  const added = checkRules({ segments: [{ type: "pruh", width: 3.2, roadClass: "mk1" }, { type: "pruh", width: 2.9 }] });
  assert.deepEqual(added.map((f) => `${f.i}:${f.level}`), ["1:min"]);
});

test("cyklisté v protisměru jednosměrky mají minimální šířku podle TP 179", () => {
  const lvl = (width) => checkRules({ segments: [{ type: "pruh", dir: "forward", bikeDir: "backward", width }] }).map((f) => f.level).join();
  assert.equal(lvl(3), "");
  const low = lvl(2.9);
  assert.ok(low.includes("zaklad"));
  assert.ok(low.includes("min"));
});

test("strop pruhu v MK I je 3,75 m, zbytek je krajnice", () => {
  const section = techLines({ features: [{ attributes: { CTMTP_KOD: "od_usek", MK: 1, SIL: 0, DALNICE: 0, TYP: 3 }, geometry: { paths: [[[ll(0.5, -50).lon, ll(0.5, -50).lat], [ll(0.5, 50).lon, ll(0.5, 50).lat]]] } }] }, frame);
  const p = road(10.5, { highway: "secondary" }, { lines: section });
  assert.deepEqual(lanes(p).map((s) => s.width), [3.75, 3.75]);
  assert.ok(lanes(p).every((s) => s.roadClass === "mk1"));
  assert.equal(p.segments.filter((s) => s.type === "krajnice").length, 2);
  assert.deepEqual(lanes(road(10.5, { highway: "secondary" })).map((s) => s.width), [4, 4]);
});

test("povrch tělesa bez údajů: autobusy asfalt, široké mezi vozovkami a těleso u kraje štěrk, jinak panely", () => {
  const tram = (x, tags = {}) => ({ type: "way", id: 40 + x, tags: { railway: "tram", ...tags }, geometry: line(x) });
  const beds = (p) => p.segments.filter((s) => s.type === "tramvaj");
  const kinds = (p) => beds(p).map((s) => s.bed).join();
  // Between two carriageways: 7 m gravel, 5.5 m panels.
  assert.equal(kinds(street([[701, 6.5], [705, 7], [701, 6.5]], { highway: "tertiary" }, { extra: [tram(-1.5), tram(1.5)] })), "strk,strk");
  assert.equal(kinds(street([[701, 6.5], [705, 5.5], [701, 6.5]], { highway: "tertiary" }, { extra: [tram(-1.5), tram(1.5)] })), "panely,panely");
  // Buses on a track (psv=yes): asphalt, both tracks of the bed.
  assert.equal(kinds(street([[701, 6.5], [705, 7], [701, 6.5]], { highway: "tertiary" }, { extra: [tram(-1.5, { psv: "yes" }), tram(1.5)] })), "asfalt,asfalt");
  // Beside the street (a roadway on one side only): gravel.
  const side = street([[705, 7], [701, 6.5]], { highway: "tertiary" }, { extra: [tram(-4.75), tram(-1.75)], axis: 3.5 });
  assert.equal(kinds(side), "strk,strk");
  // OSM's surface wins and is no estimate; asphalt is a surface of its own.
  const osm = street([[701, 6.5], [705, 7], [701, 6.5]], { highway: "tertiary" }, { extra: [tram(-1.5, { surface: "asphalt" }), tram(1.5)] });
  assert.equal(kinds(osm), "asfalt,asfalt");
  assert.ok(beds(osm).every((s) => !s.bedGuess));
  // Every estimate stays marked; a bed of asphalt passes the check of a saved profile.
  assert.ok(beds(side).every((s) => s.bedGuess));
  assert.equal(cleanProfile({ segments: [{ type: "tramvaj", width: 3.5, bed: "asfalt" }] }).segments[0].bed, "asfalt");
});

test("povrch tělesa z ortofota: zelená je tráva, jinak rozhodne pravidlo", () => {
  const tracks = [-1.5, 1.5].map((x) => ({ type: "way", id: 50 + x, tags: { railway: "tram" }, geometry: line(x) }));
  const run = (look) => street([[701, 6.5], [705, 7], [701, 6.5]], { highway: "tertiary" }, { extra: tracks, ortho: { look } });
  const got = [];
  const grass = run((s, e, rails) => { got.push([s, e, rails.length]); return { kind: "trava" }; });
  assert.deepEqual(grass.segments.filter((s) => s.type === "tramvaj").map((s) => [s.bed, s.bedGuess]), [["trava", true], ["trava", true]]);
  assert.equal(got.length, 1, "jedno těleso, jeden pohled");
  assert.equal(got[0][2], 2, "obě koleje tělesa");
  assert.ok(Math.abs(got[0][1] - got[0][0] - 7) < 0.01);
  // Nothing seen (shade, no answer): the rule.
  assert.deepEqual(run(() => null).segments.filter((s) => s.type === "tramvaj").map((s) => s.bed), ["strk", "strk"]);
});

// Synthetic orthophoto rows (bedPixels: rows across the cut, pixels along the street).
const rows = (n, len, f, res = 0.25) => { const r = Array.from({ length: n }, (_, i) => Array.from({ length: len }, (_, j) => f(i, j))); r.res = res; return r; };
test("třídění pixelů tělesa: tráva podle zelené, stín a chybějící pixely nic", () => {
  assert.equal(classifyBed(rows(20, 24, () => [105, 118, 88])).kind, "trava", "matná tráva ortofota");
  assert.equal(classifyBed(rows(20, 24, () => [120, 112, 105])).kind, null, "štěrk, panely");
  assert.equal(classifyBed(rows(20, 24, (i, j) => (j % 2 ? [105, 118, 88] : [128, 128, 128]))).kind, "trava", "půl na půl");
  assert.equal(classifyBed(rows(20, 24, (i, j) => (j % 4 ? [128, 128, 128] : [105, 118, 88]))).kind, null, "čtvrtina zelená");
  assert.equal(classifyBed(rows(20, 24, () => [20, 25, 20])), null, "stín");
  assert.equal(classifyBed(rows(1, 24, () => [105, 118, 88])), null, "málo pixelů");
  assert.equal(classifyBed(rows(20, 24, () => null)), null, "mimo obrázek");
});

test("pixely tělesa: bez kolejnic a okrajů, pražce se opakují", () => {
  // A cut along x (t), the street along y; rails of a track at t = 0 at ±0.7175 m.
  const seen = [];
  const px = bedPixels((x, y) => { seen.push(x); return [100, 100, 100]; }, -3.5, 3.5, [0], (t) => [t, 0], [0, 1], 0.25);
  assert.ok(px.length > 0);
  assert.ok(seen.every((x) => Math.abs(Math.abs(x) - 0.7175) >= 0.3 - 1e-9), "kolejnice vynechané");
  assert.ok(seen.every((x) => x >= -3.1 - 1e-9 && x <= 3.1 + 1e-9), "okraje vynechané");
  assert.ok(px.some((r) => r.sleeper) && px.some((r) => !r.sleeper));
  // Sleepers every 0.7 m at 0.1 m/px: a clear repeat; an even surface with noise: none.
  const sleepers = Array.from({ length: 60 }, (_, j) => (j % 7 < 2 ? [170, 165, 160] : [110, 104, 98]));
  assert.ok(sleeperRepeat(sleepers, 0.1) > 0.6);
  let seed = 7;
  const even = Array.from({ length: 60 }, () => { seed = (seed * 1103515245 + 12345) % 2147483648; const v = 125 + (seed % 11); return [v, v, v]; });
  assert.ok(sleeperRepeat(even, 0.1) < 0.4);
  assert.equal(sleeperRepeat([...sleepers.slice(0, 10), null], 0.1), null);
});

// A PNG of one colour (RGB, 8 bits), as ČÚZK's WMS answers.
function solidPng(w, h, [r, g, b]) {
  const crc = (buf) => { let c = ~0; for (const x of buf) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (name, data) => { const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); out.write(name, 4, "ascii"); data.copy(out, 8); out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length); return out; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([r, g, b], y * (w * 3 + 1) + 1 + x * 3);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
test("ortofoto tělesa: jeden obrázek jen u řezu přes koleje, chyba nechá pravidlo", async () => {
  const tram = (x) => ({ type: "way", id: 60 + x, tags: { railway: "tram" }, geometry: line(x) });
  const osm = { elements: [tram(-1.5), tram(1.5)] };
  assert.deepEqual(tramOffsets(osm, frame, [0, 0], [0, 1], 40).map((t) => Math.round(t * 10) / 10).sort(), [-1.5, 1.5]);
  const urls = [];
  const green = (url) => { urls.push(url); return Promise.resolve(new Response(solidPng(60, 60, [105, 118, 88]))); };
  const o = await bedOrtho({ osm, frame, dir: [0, 1], fetchImpl: green });
  assert.equal(urls.length, 1);
  assert.match(urls[0], /ORTOFOTO\/MapServer\/WMSServer.*format=image%2Fpng/);
  const at = (t) => [-t, 0]; // t = −x, as street() lays the cut
  assert.equal(o.look(-3.5, 3.5, [-1.5, 1.5], at, [0, 1]).kind, "trava");
  // No tracks: no request. A failed answer or a broken image: null, the rules decide.
  assert.equal(await bedOrtho({ osm: { elements: [] }, frame, dir: [0, 1], fetchImpl: green }), null);
  assert.equal(urls.length, 1);
  assert.equal(await bedOrtho({ osm, frame, dir: [0, 1], fetchImpl: () => Promise.resolve(new Response("", { status: 503 })) }), null);
  assert.equal(await bedOrtho({ osm, frame, dir: [0, 1], fetchImpl: () => Promise.reject(new Error("timeout")) }), null);
  assert.equal(await bedOrtho({ osm, frame, dir: [0, 1], fetchImpl: () => Promise.resolve(new Response("<html>")) }), null);
});

// Parking on the sidewalk from OSM (on_kerb, half_on_kerb; Bára 10. 11. 2026): the car's strip comes out of the
// sidewalk at the kerb (on_kerb), or half of it out of the sidewalk and half out of the roadway (half_on_kerb).
const parts = (p) => p.segments.map((s) => `${s.type}${s.position ? "/" + s.position : ""} ${s.width}`);

test("stání na chodníku: auto z chodníku u obruby, zbytek chodníku zůstává, vozovka beze změny", () => {
  assert.deepEqual(parts(road(6, { "parking:both": "on_kerb" })),
    ["chodnik 1", "parkovani/on_kerb 2", "pruh 3", "pruh 3", "parkovani/on_kerb 2", "chodnik 1"]);
  // One side only; the old scheme parking:lane:<side>:parallel=on_kerb alike.
  assert.deepEqual(parts(road(6, { "parking:right": "on_kerb" })).filter((x) => x.startsWith("parkovani")), ["parkovani/on_kerb 2"]);
  assert.deepEqual(parts(road(6, { "parking:lane:right": "parallel", "parking:lane:right:parallel": "on_kerb" })).filter((x) => x.startsWith("parkovani")), ["parkovani/on_kerb 2"]);
  // No estimate in the roadway beside cars on the sidewalk.
  assert.equal(guessed(road(10, { "parking:both": "on_kerb" })), 0);
});

test("stání napůl na chodníku: jedna část přes obrubu, 1 m z chodníku a 1 m z vozovky", () => {
  const p = road(8, { "parking:both": "half_on_kerb" });
  assert.deepEqual(parts(p), ["chodnik 2", "parkovani/half_on_kerb 2", "pruh 3", "pruh 3", "parkovani/half_on_kerb 2", "chodnik 2"]);
  assert.equal(p.notice, undefined);
  assert.deepEqual(parts(road(8, { "parking:lane:both": "parallel", "parking:lane:both:parallel": "half_on_kerb" })), parts(p));
  // § 25(3) holds here too: a two-way street of 6 m keeps 4 m; the cars stay (the data say so), the notice says it.
  const narrow = road(6, { "parking:both": "half_on_kerb" });
  assert.deepEqual(parts(narrow), ["chodnik 2", "parkovani/half_on_kerb 2", "pruh 4", "parkovani/half_on_kerb 2", "chodnik 2"]);
  assert.match(narrow.notice, /zůstává 4,00 m, § 25 odst\. 3 .* žádá 6,00 m/);
});

test("stání na úzkém chodníku: auto užší, chodníku zůstane 0,5 m; na příliš úzkém žádné", () => {
  // Perpendicular on a sidewalk of 3 m: 2.5 m of the 5 m, the notice says so, the rules warn.
  const p = road(6, { "parking:right": "on_kerb", "parking:right:orientation": "perpendicular" });
  assert.deepEqual(parts(p).filter((x) => /parkovani|chodnik/.test(x)), ["chodnik 3", "parkovani/on_kerb 2.5", "chodnik 0.5"]);
  assert.match(p.notice, /užší a chodníku zbývá 0,50 m/);
  const warn = checkRules(p).map((f) => f.text).join(" ");
  assert.match(warn, /zbytek chodníku vedle stání na chodníku/);
  // Sidewalks of 1.2 m between the houses and a roadway of 6 m: no car fits, none is drawn, the notice says so.
  const polys = [rect(601, -15, -4.2), rect(702, -4.2, -3), rect(701, -3, 3), rect(702, 3, 4.2), rect(601, 4.2, 15)];
  const way = { type: "way", id: 1, tags: { highway: "residential", "parking:both": "on_kerb" }, geometry: line(0) };
  const tight = deriveProfile({ center: [0, 0], dir: [0, 1], half: 40, polys, osm: { elements: [way] }, frame, way, inZps: false });
  assert.equal(tight.segments.filter((s) => s.type === "parkovani").length, 0);
  assert.match(tight.notice, /chodník má jen 1,20 m, auta nejsou nakreslena/);
});

test("poloha stání projde kontrolou, odkazem a do Streetmixu", async () => {
  const p = cleanProfile({ segments: [{ type: "parkovani", width: 2, position: "half_on_kerb" }, { type: "parkovani", width: 2, position: "vedle" }, { type: "chodnik", width: 2, position: "on_kerb" }, { type: "parkovani", width: 2, position: "on_kerb" }] });
  assert.deepEqual(p.segments.map((s) => s.position), ["half_on_kerb", undefined, undefined, "on_kerb"]);
  const back = await unpackProfile(await packProfile(p));
  assert.equal(back.segments[0].position, "half_on_kerb");
  const sm = toStreetmix(p, "Test").data.street.segments;
  assert.deepEqual(sm.map((s) => [s.type, s.elevation > 0]), [["parking-lane", false], ["parking-lane", false], ["sidewalk", true], ["parking-lane", true]]);
});

test("pruh BUS z bus:lanes=yes se zavřeným pruhem (access:lanes=no), s cyklisty (share_busway)", () => {
  // Českobrodská (way 112501241).
  const tags = { highway: "primary", lanes: "3", "lanes:forward": "2", "lanes:backward": "1", "bus:lanes:forward": "|yes", "access:lanes:forward": "|no", "cycleway:right": "share_busway" };
  const types = (t) => road(13.5, t).segments.map((s) => s.type).filter((x) => x !== "krajnice");
  assert.equal(types(tags).filter((x) => x === "bus_cyklo").length, 1);
  // Without the closed lane buses only may use an ordinary lane.
  const open = { ...tags }; delete open["access:lanes:forward"];
  assert.equal(types(open).filter((x) => x.startsWith("bus")).length, 0);
});

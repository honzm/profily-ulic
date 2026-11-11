# Profily ulic – aplikace

Kliknete na ulici v mapě (nebo ji najdete podle adresy) a aplikace z technické mapy a z OSM sestaví příčný profil
od fasády k fasádě. Ten pak upravujete: šířky tažením, typy, pořadí, přidávání, mazání a slučování částí, dopravní
značky, stav / návrh / porovnání, export SVG a PNG, uložení a načtení profilu (JSON), sdílení návrhu odkazem.

## Spuštění

```bash
node pilot/server.mjs
```

Pak otevřete http://localhost:5173. Potřebujete Node.js 22 nebo novější a připojení
k internetu (podkladové mapy, technické mapy IPR, měst a ČÚZK). Rozpracovaný profil si prohlížeč
pamatuje i po zavření. Server poslouchá jen na tomto počítači (`HOST=0.0.0.0` ho otevře místní síti).

Statická data, která web dostane při nasazení, si lokálně vyrobíte takto (bez nich aplikace běží, jen víc odhaduje):

| Data | Příkaz | Kam |
|---|---|---|
| dlaždice OSM celé ČR | `NAME=cz tools/build_osm_data.sh data/osm/cz.osm.pbf pilot/data/osm-tiles` | `pilot/data/osm-tiles` |
| hranice zón placeného stání v Praze | `node tools/build_zps.mjs` | `pilot/data/zps.json` |
| otevřená data Prahy (stromy, zákaz stání, třídy ulic) | `node tools/build_praha_opendata.mjs` | `pilot/data/praha/opendata` |
| vývoj zástavby Prahy | `node tools/build_vyvoj.mjs` | `pilot/data/vyvoj` |
| placené stání v Brně | `node tools/build_parkovani_brno.mjs pilot/data/brno` | `pilot/data/brno/parkovani` |
| zóny placeného stání v Plzni | `node tools/build_zony_plzen.mjs` | `pilot/data/plzen/zony.json` |

Server je vydává pod `data/…`, stejně jako web.

## Jedna stránka pro celou ČR

Přepínač měst není. Město se bere podle místa řezu (`city.js`: `cityAt` podle hranic obcí z RÚIAN v `mesta.json`,
`node tools/build_mesta.mjs`; `setCity`). Moduly čtou `city` až při použití, takže zdroje dat, ilustrace (načtou se
při prvním řezu ve městě), texty i uvedení zdrojů v exportu sedí na místo řezu. Mimo města s vlastními zdroji platí
„cesko“ (`towns/cesko.js`: celostátní technická mapa ČÚZK, domy z RÚIAN, dlaždice OSM, pražský mobiliář a vozidla
Streetmixu). Bývalé stránky `/<město>/` přesměrují na `/?mesto=<město>` i s řezem v odkazu
(`tools/city_site.mjs`, `tools/build_city_site.mjs`; místní server totéž).

## Odkud jsou data (Praha)

- **Šířky:** IPR Praha, *Mapa technického využití území* (MTVU), služba
  `gs-pub.praha.eu/.../dtmp/dtmp/MapServer/15`. Odpovědi se lokálně ukládají do `pilot/cache/mtvu`,
  stejné místo se tedy podruhé načte hned. První načtení trvá podle serveru IPR 1–10 s.
- **Tramvajové koleje:** osy kolejí z liniové vrstvy technické mapy IPR (`dtmp/MapServer/10`, kód 55010
  „MHD – osa kolejí“). Pruh s tramvají sahá 1,75 m od osy koleje ven a mezi kolejemi do poloviny osové
  vzdálenosti. Odpovídá to Manuálu tvorby veřejných prostranství IPR (kap. C.2): dvoukolejný tramvajový pás
  6,5 m při osové vzdálenosti 3 m, 7 m při 3,5 m. Zbytek vozovky široký aspoň 2,5 m se stane samostatným jízdním
  pruhem. Kde osy kolejí chybí, použije se tramvajová trať z OSM.
- **Body technické mapy IPR** (`dtmp/MapServer/9`, jeden dotaz na řez): sloupy trakčního vedení, označníky zastávek,
  sloupky, stožáry osvětlení bez vedení a stromy.
- **Otevřená data Geoportálu Praha** (CC BY 4.0, staženo při nasazení do dlaždic `data/praha/opendata`, při
  kliknutí žádný dotaz): stromy a stromořadí a uliční úseky
  TSK se zatříděním (dálnice, MK I–IV) pro šířky pruhů, varování a odhad stání. Úseky „Zákaz stání“ TSK se
  stahují také, ale profil je nepoužívá: jsou to mezery pár metrů uvnitř souvislého stání (vjezdy, kontejnery, stromy
  mezi stáními), pod rozlišením profilu (Bára 11. 11. 2026).
- **Parkování v zónách placeného stání:** úseky parkovacích stání TSK (`gs-pub.praha.eu/.../dop/zony_placeneho_stani/MapServer/3`,
  polygony). Stejná data používá i Golemio, ale bez API klíče. Mají přednost před plochami parkování z OSM.
  **Zásobování, ZTP, speciální stání:** vrstvy 5–8 stejné služby; parkovací pruh dostane účel.
- **Parkovací zálivy:** plochy parkování z OSM (`amenity=parking` s `parking=street_side`, `lane`, `on_kerb`…).
  Technická mapa je samostatně nerozlišuje, proto mají přednost před MTVU; úzké zbytky vozovky
  nebo chodníku vedle nich se k parkování přičtou.
- **Stromy:** z otevřených dat, z technické mapy a z OSM (`natural=tree_row`, `natural=tree`) do 8 m od řezu.
  V chodníku se kolem nich vyčlení stromořadí široké 1,5 m; zelený pás se stromy se označí jako stromořadí,
  bez stromů jako zeleň. Strom v pruhu stání (stromy střídající se se stáním) je prvek „Strom“ parkování: kreslí se
  za autem a popisek zní „… se stromy“. Prvek „Strom“ jde v Návrhu přidat i ručně.
- **Nástupiště MHD:** nástupiště z OSM (`public_transport=platform`, `railway=platform`, `highway=platform`;
  čáry i plochy). Ostrůvek s nástupištěm se celý označí jako nástupiště, na širokém chodníku jen pás 3 m
  u obruby.
- **Pruhy pro autobusy:** OSM `busway:*=lane`, `bus:lanes`, `psv:lanes`, `lanes:bus`, `lanes:psv`, i `bus:lanes=yes`
  u pruhu uzavřeného ostatní dopravě; **pruh BUS + cyklisté** z `cycleway:*=share_busway` nebo
  `bicycle:lanes=…|designated`. Na jednosměrce platí tagy bez strany (`busway=lane`, `cycleway=*`) jen pro pravou stranu.
- **Prvky v profilu** (kreslí se uvnitř části, v editoru jdou přidat a smazat): mobiliář z OSM a z technické mapy
  (lampy, lavičky, stojany a sdílená kola, přístřešky, označníky, sloupy trakčního vedení, rozcestníky, taxi,
  sloupky, květináče, zahrádky restaurací); bariéry a svahy z linií technické mapy (svodidla 71522/71540,
  zábradlí 61530, ploty a zdi 61209/61210/71210/81210/91210, opěrné zdi 61422/71422/81422, živé ploty 81214,
  hrany svahů 42105/42107) a z OSM `barrier=*`. Body se berou podle druhu do určité vzdálenosti od řezu (lampy
  a sloupy 20 m, zastávky 15 m, stromy 8 m, sloupky 3 m, ostatní 6 m), z řady stejných jen nejbližší.
  Lampa nebo lavička, kterou OSM položí do pruhu, se posune k nejbližší obrubě (do 3 m). Sloup nebo označník
  v kolejišti se přesune na ostrůvek vedle; sloup mezi dvěma kolejemi stojí mezi nimi s výložníky nad obě.
  Zastávka má jeden přístřešek a jeden označník; přístřešek je otevřený k tramvaji nebo autobusu u svého
  nástupiště a zadní stěnou stojí na druhém okraji.
- **Trolejové vedení:** nad pruhy pod trolejí (OSM `trolley_wire`, i jen pro jeden směr) se kreslí příčné lano
  a dva troleje ve výšce 5,4 m; v pruhu jede trolejbus města, kde ho ilustrace mají (jinak autobus).
- **Předzahrádky restaurací:** plochy OSM `leisure=outdoor_seating`. **Vodní plochy:** MTVU 500–504.
  **Barevné cyklopruhy:** `cycleway:*:surface:colour`.
- **Co v ulici je** (počet pruhů, jednosměrka, tramvaj, parkování, cyklopruhy, rychlosti, zóny): dlaždice OSM
  celé ČR (viz níže).

### Dlaždice OSM

Jedna sada dlaždic pro všechna města (`pilot/data/osm-tiles`, na webu `data/osm-tiles`) z výřezu Geofabrik Česká
republika:

```bash
mkdir -p data/osm && curl -fL -o data/osm/cz.osm.pbf https://download.geofabrik.de/europe/czech-republic-latest.osm.pbf
NAME=cz tools/build_osm_data.sh data/osm/cz.osm.pbf pilot/data/osm-tiles
```

Na Macu s QGIS přidejte před příkaz `OGR=/Applications/QGIS-final-4_2_3.app/Contents/MacOS/ogr2ogr
PROJ_DATA=…/Resources/qgis/proj GDAL_DATA=…/Resources/qgis/gdal`. Exporty ogr2ogr trvají asi 8 min, dlaždice
(`tools/build_osm_tiles.mjs`) se zapisují proudově za 1–2 min. Úsporný zápis (`pilot/public/osmtile.js`): jen značky,
které profil čte nebo by mohl (zóny, rychlosti, povrch, zastávky, přechody, druhy stromů, šířky, značky), chodníky
a pěšiny jen u ulic (v parcích, lesích a polích ne), bez polních cest; souřadnice jako rozdíly celých čísel (budovy
na 1 m); dlouhé cesty rozdělené po dlaždicích a v aplikaci zase spojené. Asi 800 MB ve 245 000 dlaždicích.
Přesné výběry (ulice, parkování, stromy, nástupiště, mobiliář, bariéry, předzahrádky, budovy s počtem podlaží)
jsou ve skriptu `tools/build_osm_data.sh`. Overpass se nepoužívá.

### Orientace stání

Podélné, šikmé a kolmé stání se bere z OSM (`orientation` u ploch parkování, `parking:*:orientation` u ulic) nebo
z dat města. U úseků TSK se dopočítá z průměrné hloubky úseku (plocha / délka) a počtu stání (`PS_ZPS`): hloubka
od 4,9 m = kolmé, pod 3 m = podélné, jinak podle délky na stání (pod 3,4 m kolmé, 3,4–4,8 m šikmé, víc podélné).
Kde nic z toho není, odhadne se z hloubky pásu: do 3,2 m podélné, do 4,6 m šikmé, jinak kolmé.
Odhad „kolmé“ vedle vozovky užší než 5 m je šikmé: do kolmého stání se zajíždí z asi 6 m, do šikmého pod 45° ze 3,5 m
(ČSN 73 6056; Laubova, kde stromy mezi stáními kazí délku na stání).
V editoru jde orientace změnit ručně. Kolmé stání má podle ČSN 73 6056 hloubku 5,0 m, s přesahem vozidel
přes obrubník 4,5 m; užší změřený pás kolmého stání se doplní na 4,5 m z chodníku nebo zeleně za obrubníkem.

**Stání na chodníku** (`parking:<strana>=on_kerb|half_on_kerb`, ve starém schématu
`parking:lane:<strana>:<orientace>=on_kerb|half_on_kerb`): technická mapa tam kreslí chodník. `on_kerb` vyčlení
z chodníku u obruby pás celého auta (2 / 4,5 / 5 m podle orientace) na úrovni chodníku, `half_on_kerb` polovinu
z chodníku a polovinu z vozovky jako jednu část přes obrubu (auto nakloněné). Chodníku zůstane aspoň 0,5 m:
na užším se auto zúží (na celém chodníku nejméně na 1 m, polovina na chodníku na 0,3 m), jinak se nekreslí; obojí
řekne hláška u profilu, stejně jako když vozovka po polovině aut nesplní § 25 odst. 3 (3 m pro každý směr).
Pruhy se pak dělí podle zbytku vozovky (nejméně jeden). U úseku TSK, plochy MTVU 704 nebo úseku města u obruby
zůstane jejich šířka a z OSM se vezme jen poloha. Část nese `position` (v Návrhu „Poloha“, v odkazu, do Streetmixu
jako parking-lane, zvýšená u `on_kerb`), varování hlídá zbytek chodníku (min. 1,5 m) a značky jsou IP 11d až IP 11g.

### Výška a vzhled budov

Počet podlaží budov na okrajích profilu se v Praze bere z vrstvy IPR *Podlažnosti*
(`mp.iprpraha.cz/.../URK_CUR_URK_SS_PODLAZNOST_P/FeatureServer/0`: podlaží po římsu, střešní/ustupující
podlaží, celkem, příznak nové budovy), v Brně z Průzkumu budov KAM, v Plzni z 3D budov, jinde z RÚIAN ČÚZK
(`gis.js` `ruianBuilding`: podlaží, využití, rok dokončení, druh konstrukce), jinak z OSM `building:levels`
(+ `roof:levels`). Výška se kreslí 3,5 m na podlaží (přesná výška z OSM `height` nebo z 3D budov), střešní podlaží
užší a tmavší. Šest vzhledů domu (šikmá střecha, funkcionalistický činžák, moderní bytový dům, panelák, nízký dům,
hala) se volí podle tvaru bloku z OSM, údajů o domě a stáří zástavby: v Praze z vrstvy IPR *Vývoj zástavby*
(statické dlaždice z `tools/build_vyvoj.mjs`), jinde z roku dokončení v RÚIAN (do 1919 a 1946–57 šikmá střecha,
od 1958 panelová éra, od 1996 moderní dům). Vnitřní město a sídliště podle vzdálenosti od centra má každé město
vlastní (`city.js` `innerKm`, `estateKm`).

## Brno

Stejně jako Praha se Brno ptá služeb města při kliknutí (přímo z prohlížeče, služby povolují CORS). Úpravy
výpočtu, které platí všude kromě Prahy, zapíná `city.fix` (`city.js`): křižovatky i se `service`, osa OSM vedle
vozovky se posune na ni, zpevněná plocha do 25 m pod osou silnice je vozovka.

- plochy: MTVU města (`gis.brno.cz/ags3 … PUBLIC/opendata_mtvu`, vrstva 1). Brněnské kódy 5100xxx
  (číselník v legendě `PUBLIC/ted_MTVU_plochy_povrch`) převádí `brnoMtvuCode` v `sources.js` na pražské;
- koleje, svodidla, ploty, zdi, zábradlí, svahy a body (lampy, stromy, lavičky, sloupky): kresba technické
  mapy UMPS (`PUBLIC/opendata_umps`, jeden dotaz `identify`). Kódy linií mají stejnou soustavu jako IPR
  s předponou (`brnoLineCode`: 1255010 → 55010);
- parkování: aktuální úseky placeného stání z mapy parkovanivbrne.cz, stažené při nasazení do dlaždic
  (`tools/build_parkovani_brno.mjs`, `data/brno/parkovani/`); export na data.brno.cz je starší. Oblasti
  rezidentního parkování se nepoužívají (ohraničují celé čtvrti, i ulice bez placeného stání): kde u řezu
  úsek není, profil stání odhadne;
- cyklopruhy, piktokoridory a protisměr: Cykloopatření – zrealizovaná (data.brno.cz), jen kde OSM nic neříká;
- mosty: nadzemní plochy MTVU (`PUBLIC/ted_MTVU_plochy_nadzemni`), jen pro řez na mostě;
- budovy: Průzkum budov v Brně (KAM): podlaží, podlaží ve střeše, střecha.

Pro města bez vlastní služby je v `tools/` schovaný záložní postup z veřejné DTM kraje (IS DMVS ČÚZK, bez přihlášení).
`tools/fetch_dtm_brno.sh` stáhne sady ZPS_KR a DI po městských částech, `tools/build_dtm_brno.py` z hranic a
definičních bodů složí plochy (všechny části najednou, v oknech, s uzavřením mezer do 1 m), kde chybí
obruby, rozdělí slité plochy podle OSM a nejbližších definičních bodů (označené „odhad“) a zapíše dlaždice
`{p, l}`. Pro Brno to dalo 10 sedí / 79 částečně / 11 špatně ze 100 řezů (MTVU města je přesnější).
Spuštění (QGIS Python s GDAL a shapely):

```
tools/fetch_dtm_brno.sh
Q=/Applications/QGIS-final-4_2_3.app/Contents
PROJ_DATA=$Q/Resources/qgis/proj GDAL_DATA=$Q/Resources/qgis/gdal $Q/MacOS/python tools/build_dtm_brno.py data/dtm-brno/zip data/osm/brno_ways.geojsonl <výstup>
```

## Města jako moduly

Každé město je jeden modul `pilot/public/towns/<město>.js` (vzor `towns/jihlava.js`): zdroje dat pro
kliknutí (`osm`, `surfaces`, `lines`, `parking`, `podlaznost`) ve stejném tvaru jako odpovědi IPR, podkladové
mapy (`maps`) a ortofoto pro kontrolu řezů (`ortho`). Společné funkce jsou v `pilot/public/gis.js`, dlaždice OSM
čtou všechna města stejné. Texty aplikace a uvedení zdrojů jsou v `city.js`, servery pro CSP a staré adresy
v `tools/cities.mjs`. Nové město: záznam v `city.js` a `tools/cities.mjs`, modul v `towns/` (a v `towns/index.js`),
kód obce v `tools/build_mesta.mjs` (pak `node tools/build_mesta.mjs`), ilustrace v `pilot/public/<město>/`,
kontrola `CITY=<město> node evaluation/sample.mjs|run_brno.mjs|render_brno.mjs` a A/B test (níže).

Ilustrace měst (`pilot/public/<město>/`, podle fotek z Wikimedia Commons): tramvaje, trolejbusy a autobusy místních
dopravců, sloupy trakčního vedení a označníky; mobiliář je kromě Brna pražský. Vlastní vozidla mají Praha (T3,
SOR NB 12), Brno (Tatra T3 v nátěru DPMB, 45T a 13T, autobus DPMB), Jihlava (32Tr, Citelis), Most (EVO2, SOR NB 12),
Opava (32Tr, Urbanway), Pardubice (32Tr, Urbanway), Plzeň (40T, 26Tr, SOR NS 12), Ostrava (Tango NF2, 26Tr,
Urbino IV CNG) a Ústí. Olomouc, Liberec, Hradec Králové, České Budějovice a Zlín berou data jako zbytek Česka
a mají jen vlastní vozidla (`city.js` `artTown`). Jinde kreslí vozidla Streetmix.

### Jihlava

Služby města (`gis.jihlava-city.cz`, CORS povolený):

- plochy: **pasport komunikací** (`server1/ost/Pasporty/MapServer/112`, úseky „vozovka“ a „chodník“ s
  povrchem, třídou a názvem ulice) → kódy MTVU 701 a 702; **budovy RÚIAN** (`server/ost/ORP_RUIAN/7`, i s
  počtem podlaží a využitím) → 601; **trávníky** z pasportu zeleně (`Pasporty/25`) → 401; zbytek z **katastru**
  (`server/ost/Ji_parcely/1`, druh pozemku): zahrada → 300, travní porost a zeleň → 401, zastavěná plocha a
  nádvoří → 603, pole, les, voda, manipulační plocha; pozemek komunikace mimo pasport → zeleň (odhad), jen je-li
  v okolí vozovka z pasportu. Pásy silnic v pasportu (celá koruna silnice) se zúží o 1,25 m na stranu.
- parkování: **parkovací místa města** (`server1/verejnost/doprava_verejnost/MapServer/105`) jsou čáry s druhem
  stání (podélné, šikmé, kolmé), režimem a počtem míst. Každá čára je pruh hloubky 2,0 / 4,5 / 5,0 m; leží-li
  vozovka jen na jedné straně čáry (čára u obrubníku), pruh leží na té straně, jinak je čára jeho osou.
  Úseky „Zákaz stání / zastavení“ se vynechávají, K+R, taxi a vyhrazená stání jsou „zvláštní stání“.
- linie: ploty, zábradlí, zdi, svodidla a protihlukové stěny z technické mapy (`server1/DTM/DTM_ZPS_verejnost/12`).
- body: stromy (`Pasporty/28`), stožáry osvětlení (`Pasporty/50`), přístřešky a lavičky zastávek (`Pasporty/127`)
  a stojany na kola (`doprava_verejnost/150`), kde je OSM nemá do 3 m (přístřešek do 15 m).
- souřadnice: služby města převádějí S-JTSK do WGS 84 jinou transformací (asi 6 m vedle OSM), dotazy proto žádají
  `datumTransformation=1623` jako u IPR.
- další vrstvy města (nepoužité): jednosměrky a cyklo-obousměrky, obytné zóny a zóny 30, přechody, trolejové
  vedení a trakční sloupy, zastávky s vybavením, dopravní značky, mosty.

### Most, Opava, Plzeň

- **Most** (`mapy.mesto-most.cz`): plochy z objektové mapy povrchové situace v otevřených datech
  (`Opendata/OpendataDtmOmps/FeatureServer/9`, kódy `KOD_OMPS`/`KOD`), linie z technické mapy (`DTM/DtmUMPS`:
  ploty, zdi, zábradlí, svodidla, osy kolejí jen do 3 m od tramvaje v OSM), stromy a lavičky z technické mapy,
  lampy z otevřených dat; stání s orientací město nemá. Datum sedí. Kontrola 57 řezů: `evaluation/most/ZPRAVA.md`.
- **Opava** (`mapy.opava-city.cz`, složka `external`): plochy z účelové mapy povrchové situace
  (`info_dtm_plochy_find/0`, pole `POPIS`; vozovky ulic jsou čtyři polygony přes celé město, tři s chybným popisem,
  čtou se zvlášť a zjednodušené), stání placených zón (`dopr_zps`), stromy, lavičky, kryté zastávky, stojany.
  Služby jsou 4 m vedle OSM, dotazy s `datumTransformation=1623`. Kontrola 50 řezů: `evaluation/opava/ZPRAVA.md`.
- **Plzeň** (`ags.plzen.eu`): technická mapa ve struktuře JVF DTM (`GIS_DTM/GIS_DTM_ZPS_kesovana/FeatureServer`,
  jeden dotaz na asi 45 vrstev ploch a linií), 3D budovy s výškou okapu a hřebene (`GIS_3D_budovy`), stromy,
  lavičky, stojany a sloupky z pasportů, ortofoto 2024. Služby jsou 12 m vedle OSM: dotazy s 1623, kde to vrstva
  nepřijme, posun vstupu. Osy kolejí město nezveřejňuje (z OSM), tramvajová tělesa jsou výchozí z panelů.
  Zóny placeného stání z otevřených dat (CC0, `tools/build_zony_plzen.mjs` při nasazení): podél čáry zóny se
  u obrub nakreslí stání 2 m jako odhad. Kontrola 50 řezů: `evaluation/plzen/ZPRAVA.md`.

### Ostrava, Frýdek-Místek, Karviná, Třebíč, Přerov, Ústí nad Labem

Připojená po srovnání s celostátní DTM ČÚZK nad ortofotem (`evaluation/<město>/data/ab-*/review.md`).

- **Ostrava** (`towns/ostrava.js`, `mapy.ostrava.cz`): plochy z generalizované technické mapy města
  (`MAPPA/Polohopis_DTM_generalizace/MapServer/0`, pole `POPIS`), zpevněná plocha s osou koleje
  (`BaseMap/podkladova_mapa_OSTRAVA/MapServer/25`) je tramvajový pás, zdi a ploty z obrysů ploch, úseky placeného
  stání (`SMO/parkovaci_mista/MapServer/9`). Dotazy s `datumTransformation=1623` (jinak 1,5 m vedle OSM).
- **Frýdek-Místek** (`towns/frydek-mistek.js`) a **Karviná** (`towns/karvina.js`): pasport komunikací na serverech
  T-MAPY (WFS 2.0 `…/common/pakom/gservice`, typ `ms:pk-pov`), zeleň z pasportu zeleně (`pazel`) jen tam, kde DTM
  nic nemá, stromy, lavičky, stojany a lampy z pasportů. Pasport leží nad celostátní DTM (`towns/overlay.js`);
  kde ta nemá nic, doplní domy a parcely RÚIAN. WFS se ptá v WGS 84 a odpovídá ve Web Mercatoru (`srsName=EPSG:4326`
  s boxem vrací nic). Frýdek-Místek je pak 0,5 m vedle RÚIAN (posun v modulu), Karviná sedí. Pasport Karviné
  pokrývá jen část města (Fryštát, část Nového Města a Ráje), jinde zůstává DTM ČÚZK. Karviná má i linie technické
  mapy (`dtmm`, `ms:dtm-umps-l`): ploty a opěrné zdi. Server Frýdku-Místku posílá neúplný řetěz certifikátů
  (Chrome si ho doplní; skripty v Node potřebují `NODE_EXTRA_CA_CERTS` s mezilehlým certifikátem Alpiro).
- **Třebíč** (`towns/trebic.js`, `gis.trebic.cz`): pasport komunikací PaKom 2020 (`public/PaKom2020/MapServer/6`,
  `typ_pov_05`; parkoviště podle poznámky) nad celostátní DTM, lampy (`public/VO`) a lavičky. Dotazy s 1623.
- **Přerov** (`towns/prerov.js`): technická mapa jen jako vektorové dlaždice v S-JTSK
  (`DTM_polohopis_vector/VectorTileServer`). Modul čte dlaždice úrovně 7 kolem řezu (`towns/mvt.js`), převede je
  do WGS 84 (`towns/sjtsk.js`, Křovák + EPSG 1623, sedí s PROJ na 1 mm) a druh plochy bere z názvu vrstvy.
- **Ústí nad Labem** (`towns/usti.js`): plochy z DTM ČÚZK (Ústecký kraj ji má celou), k tomu
  **parkovací místa města** (`mapy.usti.cz`, `Doprava/Parkovaci_zony_UL/MapServer/3`, řada stání s druhem: podélné,
  kolmé, šikmé, vyhrazené, ZTP; asi 435 řad v centru a okolí). Služba je bez `datumTransformation=1623` asi 12 m
  vedle OSM. A/B nad ortofotem (`evaluation/variants/usti-stani.mjs`, 36 řezů u stání): lepší 6, horší 1, stejně 3.

### Celostátní technická mapa (Pardubice a zbytek Česka)

- **DTM krajů z WFS** (`pilot/public/dtmwfs.js`): v devíti krajích s DTM od T-MAPY (Jihočeský, Pardubický,
  Vysočina, Moravskoslezský, Královéhradecký, Jihomoravský, Liberecký, Karlovarský, Zlínský) dává mapová služba
  kraje WFS 2.0 se skutečnými polygony (`…/mapservice/v1/wms/dtm_zps_plochy_bar`, GML v S-JTSK, CORS). Kraj řezu
  se pozná podle `kraje.json` (`node tools/build_kraje.mjs`), jeden dotaz, kliknutí medián 0,65 s. A/B 137 řezů
  proti obrázkům DMVS: lepší 6, horší 3, jinak stejně; ploty a zdi z WFS se nepřipojují (uříznou chodníky).
  `evaluation/dtm-wfs/ZPRAVA.md`.
- **Obrázky IS DMVS ČÚZK** (`pilot/public/dmvs.js`): jinde, při chybě WFS nebo když do 1,5 s neodpoví. Služba
  nevrací tvary, jen obrázky a typ plochy v bodě: modul stáhne obrázek ploch a hraničních linií (0,1 m/px),
  rozdělí ho podle barev legendy, obtáhne obrysy a typ bílých a šedých ploch na řezu doptá (průměrně 6 dotazů,
  kliknutí kolem 1 s).
- Prázdná místa DTM doplní budovy a parcely RÚIAN; kde DTM kolem řezu nemá nic, je profil odhad z OSM. Kvalita
  záleží na kraji: v Pardubicích chybí vozovky mimo zástavbu a plochy uvnitř bloků. Mosty jsou vozovka.
  Tramvajová plocha DTM s vozovkou po obou stranách bez obruby nebo zeleně mezi nimi jsou koleje ve vozovce.
- Pardubice (`towns/pardubice.js`) nemají vlastní služby, mají jen vlastní ilustrace. Kontrola 49 řezů:
  `evaluation/pardubice/ZPRAVA.md`.

### Zkoušené a nepřipojené zdroje

- Pasport komunikací Hradce Králové (T-MAPY WFS `geoportal.mmhk.cz/services/mapserver/common/pakom/gservice`,
  vrstva `pk-pov-typ`): skoro stejné plochy jako DTM ČÚZK (95 řezů: lepší 4, horší 3, stejně 7, obě špatně 2),
  bez CORS; varianta `evaluation/variants/hradec-pasport.mjs`.
- **České Budějovice** nezveřejňují plochy ulic; na ArcGIS Online města (`services9.arcgis.com/8svDug0pVvBQzXWS`)
  jsou jen osy pasportu a chodníků bez šířek, trávníky, lavičky a úseky placeného stání (čáry bez způsobu stání).
  DTM kraje má stejné díry jako DMVS (22 ze 47 řezů bez ploch). A/B: `evaluation/budejovice/ZPRAVA.md`.
- Bez vlastního zdroje zůstávají Olomouc, Zlín, Havířov, Třinec, Prostějov, Znojmo, Kroměříž (jen WMS nebo nic).
- Dopravní značení z pasportů T-MAPY (Děčín, Jablonec, Tábor) je příliš řídké.

## Test nového zdroje (A/B)

**Pravidlo: nový zdroj (nebo jiné použití starého) jde do aplikace, jen když nad ortofotem vyhraje.**

- Varianta je soubor `evaluation/variants/<název>.mjs`. Exportuje náhrady některých z pěti zdrojů
  `sources.js` (`osm`, `surfaces`, `lines`, `parking`, `podlaznost`, se stejnými argumenty a odpověďmi) a krátký
  popis `about`. Co nenahradí, bere se z běžných zdrojů města. Varianta `city` je současný stav (bez souboru).
- `CITY=jihlava VARIANTS=city,moje-varianta node evaluation/ab.mjs [od] [do]` spočítá každý řez vzorku
  (`evaluation/<město>/data/samples.json`) jednou za každou variantu, na stejné čáře řezu. Víc variant
  (`city,x,y`) srovná první s každou další. `ONLY=9,10` jen vybrané řezy; `CACHE=disk` si odpovědi služeb uloží
  (`data/ab-cache`) a opakovaný běh se už služeb neptá. Dotazy na ČÚZK jdou ohleduplně přes `evaluation/polite.mjs`
  (jeden po druhém, 300 ms od sebe, pauza při 429 nebo 503).
- Výstup `evaluation/<město>/data/ab-<a>-<b>/`: `<n>.json` (oba profily, čas, počet dotazů, míry: šířka celkem,
  vozovka, chodník, okraje, podíl „Neurčeno“, odhad z OSM), `png/<n>.svg.png` (lišící se řezy nad ortofotem,
  A nahoře, B dole) a `review.md` (řádek na každý lišící se řez: vozovka nebo chodník o víc než 0,5 m, jiný okraj).
- Do `review.md` se místo `?` doplní verdikt `a`, `b`, `obě` nebo `žádná`. Pak
  `… node evaluation/ab.mjs --summary` vypíše shodu, mediány rozdílů a součty verdiktů; `--render [n …]` znovu
  nakreslí obrázky.
- Příklad: pasport komunikací v Jihlavě, `evaluation/jihlava/PASPORT.md`.
- **Změna pravidla** (ne zdroje): varianta exportuje `deriveProfile` z kopie kódu před změnou
  (`cp -R pilot/public/*.js pilot/public/towns evaluation/<složka>/data/kod-0`, vzor `variants/pred-zakon.mjs`).
  `ITEMS=1` počítá i stání a předměty, `PARTS=1` i druhy částí (např. druh tramvaje) a šířky pruhů a krajnic.
  Příklad: `evaluation/pravidla-11-2026/ZPRAVA.md`.

## Jak se profil skládá

1. Najde se nejbližší ulice z OSM a řez se vede kolmo na její osu. Ulice pod mosty a podzemní cesty se ignorují.
2. Řez se rozdělí podle ploch technické mapy (silnice, chodník, cyklostezka, parkoviště, tramvajové těleso,
   zeleň, zahrady…). Profil končí u první budovy, u zahrady (ta se kreslí jako okraj mimo ulici),
   nebo 22 m od osy. Dům za výchozím dosahem, ke kterému vedou jen trávníky, cesty, vozovky a parkovací pruhy,
   profil k sobě protáhne (do 40 m); dvůr, zahrada, pole nebo neznámý úsek ho zastaví. Tažením konce řezu jde
   dosah na každé straně zvlášť zkrátit nebo prodloužit (3–67 m, data se čtou až do 70 m): zkrácená strana končí
   volným okrajem, prodloužená jde přes ploty, zahrady a trávníky k další budově nebo k taženému konci.
3. Vozovka se podle tagů OSM rozdělí na parkovací pruhy, cyklopruhy a jízdní pruhy:
   `cycleway:*=lane` → cyklopruh 1,5 m, `soft_lane` → ochranný pruh 1,5 m, `shared_lane` → piktokoridor
   v krajním pruhu; cyklisté v protisměru (`oneway:bicycle=no` u jednosměrky, `opposite_lane`, `opposite`,
   `cycleway:*:oneway=-1`) dostanou opačný směr než auta a popisek „cyklisté v protisměru“;
   `parking:*=lane|street_side` → parkovací pruh (pokud tam už není parkoviště z technické mapy nebo plocha z OSM);
   `lanes:forward`/`lanes:backward` určí počty pruhů v každém směru a `turn:lanes(:forward|:backward)` řazení
   (vlevo, rovně, vpravo). Obousměrná ulice s jednou osou má polovinu pruhů každým směrem; místní obousměrka se
   dělí na dva pruhy od 5,0 m vozovky (2 × 2,5 m). Směr pruhů se bere z nejbližší osy OSM ve vozovce,
   takže sedí i na směrově rozdělených silnicích. Kde vozovkou vedou koleje, vznikne kolem každé osy koleje pruh
   s tramvají a vedle něj jízdní pruhy pro auta.

   **Tři druhy tramvaje** (A/B v `evaluation/pravidla-11-2026/ZPRAVA.md`):
   - *Tramvaj v pruhu* (`tramvaj_v_pruhu`): koleje ve vozovce (`embedded_rails=tram`) a auta jezdí po nich, protože
     se vedle nevejdou všechny pruhy, které OSM počítá, nebo je OSM nepočítá.
   - *Tramvajový pruh* (`tramvaj_pruh`, vyhrazený ve vozovce): všechny pruhy z OSM (`lanes`, `lanes:forward`,
     `lanes:backward`) se vejdou vedle kolejí (Národní, Spálená), nebo koleje ve vozovce ulice s `embedded_rails`
     nemají auta vedle sebe. Kreslí se v úrovni vozovky se širokou čarou u pruhů pro auta.
   - *Tramvajové těleso* (`tramvaj`, samostatné): MTVU 705 a obdobné plochy měst, koleje v zeleni (tráva) a koleje
     ve vozovce bez aut vedle, když ulice nemá `embedded_rails` (Patočkova). Kreslí se zvýšené mezi obrubami.
     Povrch (`bed`) podle `surface` tramvajové trati v OSM; jinak tráva, kde je na malém výřezu ortofota ČÚZK
     zeleno (`ortho.js`, jen pro řez s kolejemi, souběžně s ostatními dotazy), a jinak podle pravidel jako odhad:
     asfalt, kde jezdí autobusy, štěrk u okraje ulice nebo mezi vozovkami od 6 m, panely jinde a v pěší zóně.
   - Tramvajová trať s `psv` nebo `bus` = `yes`/`designated` (nebo `highway=busway`) dává části vlastnost
     `withBus` („+ BUS“). Do Streetmixu jdou všechny tři druhy jako streetcar.

4. Chodník (MTVU 702) s osou OSM, po které smějí kola: `segregated=yes` → oddělená stezka C 10 (chodník a
   cyklostezka, každý na polovinu, kola blíž vozovce), `bicycle=designated` (nebo `segregated=no`) → společná
   stezka pro chodce a cyklisty C 9, `bicycle=yes` → chodník s vjezdem cyklistů. Bez vlastní osy rozhoduje
   tag ulice `sidewalk:<strana>:bicycle`. Do Streetmixu jde C 9 jako cyklopruh v úrovni chodníku, chodník s koly
   jako chodník.

   Cyklostezka (MTVU 703) dostane směr z cyklostezky v OSM, která jí vede: jednosměrná jede se svou osou,
   obousměrná se rozdělí na dvě poloviny. Úzký vyvýšený zpevněný pás (do 6 m) mezi dvěma vozovkami
   se označí jako dělicí pás / ostrůvek.

5. Pruh je široký nejvýš 4 m (dálnice a silnice pro motorová vozidla 3,75 m, místní ulice 4,5 m; v Praze MK I
   a dálnice podle zatřídění TSK 3,75 m, i když je OSM má za primary nebo residential). Zbytek vozovky
   od 1 m se nakreslí jako **krajnice / šrafy** a označí jako odhad: technická mapa neobsahuje
   vodorovné značení. Vozovka směrově rozdělené silnice má krajnici jen u vnějšího okraje, ostatní vozovky
   (i jednosměrky ve městě) u obou obrub.
6. **Odhadnuté podélné stání** 2 m podle § 25 zák. 361/2000 Sb.: při stání musí zůstat volný jízdní pruh aspoň
   3 m pro každý směr jízdy. Obousměrka ho dostane od 8 m vozovky na jedné straně a od 10 m na obou, jednosměrka
   od 5 m a od 7 m; pruhy vedle zůstanou široké aspoň 3 m (tolik, kolik jich OSM počítá). U tramvaje zůstane mezi
   autem a kolejnicí 3,5 m (§ 25 odst. 2). U obruby ke střednímu pásu, tramvajovému tělesu, zeleni do 15 m před
   další vozovkou nebo k další vozovce se neodhaduje. Mimo zástavbu bez chodníku také ne: u obruby není chodník
   (plocha chodníku nebo stezky za ní, i za zelení do 10 m, tag OSM `sidewalk` nebo pěší cesta OSM podél ulice
   do 12 m) a na té straně není dům (OSM ani plochy města) do 40 m od obruby a ±40 m podél ulice. Ve vesnici
   a v úzkých uličkách se domy najdou, odhad tam zůstává.
   Platí v ulicích residential a unclassified (na hlavních ulicích ne; v Praze ani v MK I a II podle TSK), jen mimo
   zóny placeného stání: do 100 m od řezu nesmí být žádná zóna TSK (vrstva „Zóny placeného stání vymezené
   tarifem“). Hranice zón se stahují jednou skriptem `node tools/build_zps.mjs` do `pilot/data/zps.json` (na webu
   při nasazení), takže se kvůli nim IPR při kliknutí neptá. Bez souboru rozhodují úseky TSK kolem řezu. Odhad se
   nepřidá, kde je stání z dat města nebo z OSM nebo kde ho tag zakazuje.
7. Obytné a pěší zóny (`living_street`, `pedestrian`) mají vozovku jako jeden pruh bez ohledu na počet pruhů v OSM
   a bez krajnice (Streetmix sdílený prostor nezná). Odhad stání v obytné zóně není (§ 39: stání jen na
   vyznačených místech), stání z OSM nebo z dat města zůstává. V zóně uzavřené autům, kudy jezdí MHD, nese pruh
   autobus nebo pod trolejí trolejbus.
8. Svodidlo z technické mapy s osou silnice na obou stranách rozdělí plochu vozovky a vznikne **dělicí pás** 0,6 m.
   U ulice ze dvou jednosměrných os se stejným jménem (protisměrných) se střed řezu posune doprostřed mezi ně
   (třeba na tramvajový pás), dosah se měří odtud a zeleň mezi vozovkami profil neukončí.
9. Klik do mapy posune řez po ulici aspoň 15 m od křižovatky, 12 m od kruhového objezdu a obratiště a 6 m od
   přechodu (tažený řez zůstane, kam ho dáte).
10. Kde technická mapa pod osou ulice nemá zpevněnou plochu (pole, louka, zeleň, díra v mapě), profil je odhad
    z OSM a aplikace to napíše. Parkoviště MTVU (704) široké aspoň 8 m profil ukončí jako okraj „parkoviště“.
    Úsek useknutý dosahem se celý ponechá nebo vynechá, když by z něj zbylo méně než 1,5 m.
    Plot nebo zeď (technická mapa: ploty a zdi nad 0,3 m; OSM: fence, wall, hedge) za krajní vozovkou
    profil ukončí jako okraj „plot“; plot do 1 m od fasády budovy ale okrajem zůstává budova.
11. Konec A je vždy západní, B východní; tlačítko **⇄ Otočit** je prohodí (zrcadlí stav, návrh i opravy, domy si
    nechají barvy).
12. Lokální server neukládá do cache chybové odpovědi IPR a dotazy na IPR vzdá po 20 s; server IPR často vrací
    503, aplikace dotaz opakuje.

## Stav, Návrh a úpravy

Stav je jen k prohlížení; kliknutí na část řekne, co to je a odkud pochází. Data se opravují po tlačítku
**Opravit data**. Návrh je editovatelný vždy. Úpravy drží šířku ulice: **← Sloučit** / **Sloučit →** dá šířku
části sousedovi, po smazání se vybere soused. Hlídá se šířka ulice: v Návrhu proti stavu, při opravě dat proti
šířce změřené před opravou. Když ji profil překročí nebo nevyplní, objeví se upozornění a tlačítko Dorovnat (rozdíl
dostane vybraná, jinak nejširší část).

Šířky částí se porovnávají s Manuálem tvorby veřejných prostranství IPR, kap. C.2 (`public/rules.js`): červeně pod
minimem (chodník 1,5 m, pruh 2,5 m, cyklopruh 1,5 / 1,75 / 2 m podle stání vedle, ochranný cyklopruh 1,25 m,
podélné stání 2 m, kolmé 4,5 m, dvoukolejný tramvajový pás 6,5 m…), oranžově pod základní šířkou (chodník 2 m,
pruh 3 m, ochranný cyklopruh 1,5 m, kolmé stání 5 m, tramvajový pás bez sloupů 7 m, se sloupy 8 m…). Kliknutím na
upozornění se část vybere. Tramvajový pás je vyhrazený tramvajový pruh i samostatné těleso, ne tramvaj v pruhu
s auty.

Jednosměrka s cyklisty v protisměru (značka IP 4c pod pruhem) bez vlastního cyklopruhu: vozovka, tedy pruhy
s krajnicí a šrafami bez stání, červeně pod 3 m, oranžově pod 4 m (Manuál C.2: základ 4 m, při velmi nízké
intenzitě 3 m, při vyšší až 4,5 m; Bára 11. 11. 2026). Nahrazuje varování jednotlivých pruhů.

Jízdní pruh v Praze podle zatřídění TSK (skupina ČSN 73 6110; MK I a II jsou podle zák. 13/1997 Sb. sběrné
nebo rychlostní, TSK to nerozlišuje, proto skupina B): dálnice červeně pod 3 m, oranžově pod 3,5 m; MK I, MK II
a silnice I. a II. třídy červeně pod 3 m; MK III a silnice III. třídy červeně pod 2,75 m, oranžově pod 3 m;
MK IV červeně pod 2,5 m, oranžově pod 2,75 m. Bez zatřídění (ostatní města) 2,5 / 3 m. Pruh přidaný v Návrhu
převezme třídu ostatních pruhů ulice.

Pod profilem je pruh **podílu šířky ulice** (chůze, kola, MHD, jedoucí auta, parkování, zeleň, ostatní; sdílené
části napůl), v Porovnání se změnou. Návrh (i ručně opravený stav) jde **sdílet odkazem** (je zabalený v adrese za
řezem), uložit do souboru JSON a zase načíst. U řezu je **panorama z ulice** Mapy.com (s klíčem v dialogu, bez
něj odkaz na Mapy.com).

## Dopravní značky

Pod popisky částí je řádek dopravních značek podle vyhl. 294/2015 Sb. (`public/signs.js`, obrázky v `public/znacky/`,
licence v `znacky/README.md`), na obrazovce i v exportu, všechny v jednom měřítku jako na ulici. Značky vycházejí
z tagů OSM a z částí profilu: nejvyšší rychlost (i po pruzích), jednosměrka IP 4b / B 2 podle směru pohledu (i
s cyklisty v protisměru; po „Otočit“ se vymění), zóny (zóna 30, obytná, pěší, cyklistická), zákaz vjezdu B 1 a B 11
s dodatkovou tabulkou výjimky, B 8, B 30, dálnice a silnice pro motorová vozidla, stezky C 8a, C 9a, C 10a, parkoviště
IP 11 se způsobem stání (i na chodníku IP 11d–g), vyhrazené IP 12 a ZTP, zákaz stání B 29 a zastavení B 28, pruh
BUS IP 20a (i s cyklisty), směrové šipky V 9a z `turn:lanes`. Rychlost, jednosměrka a zóny stojí pod jízdními pruhy;
značka společná sousedním částem se kreslí jednou se závorkou; nejvýš 2 značky na část, co se nevejde, ukáže šedá
tečka. V Návrhu jdou značky měnit u každé části i přes celou vozovku. Značky se drží v odkazu, v souboru i po
„Otočit“.

## Mapa

Podkladové mapy **Mapa**, **Ortofoto**, **Technická mapa** a **OpenStreetMap**. Mapa je OSM s mapami měst (v Praze
rychlý rastr IPR z ArcGIS Online, v Brně MTVU města), ortofoto ČÚZK s ortofoty měst, technická mapa DMVS ČÚZK
s mapami měst; vrstvy měst se načítají a uvádějí jen na jejich území. Navrch jdou zapnout linie technické mapy,
plochy u řezu a další data řezu (`public/maplayers.js`): parkování z místních dat a z OSM, body (stromy, lampy,
sloupy…; v dosahu plné, mimo dosah prázdné), ploty, zdi a svahy, koleje, osy ulic, budovy na fasádách, dosah bodů.
Kreslí se jen to, co už kliknutí načetlo, nic se kvůli tomu znovu neptá. Vybraný podklad a vrstvy si prohlížeč
pamatuje.

**Hledání adres** (`public/search.js`): vyhledávací služba RÚIAN ČÚZK, návrhy od 3 znaků s prodlevou 300 ms; adresa
nebo ulice rovnou udělá řez na své ulici.

Barevný proužek pod každou částí ukazuje původ: zelená = změřeno z technické mapy, hnědá = doplněno z OSM,
modrá = otevřená data města, tyrkysová = parkování z dat města, šedá = odhad, fialová = upraveno ručně.

## Export do Streetmixu

Převod profilu na ulici Streetmixu (schéma 35, metrické jednotky) je v `public/streetmix.js` a má testy. Tlačítko
v aplikaci není: API Streetmixu nemá CORS, takže ze statického webu nefunguje.

## Záznam řezů

Po každém řezu a u několika akcí (export, uložení, sdílení, Návrh, Porovnání, oprava dat, hledání) pošle
`public/log.js` krátkou zprávu přes `navigator.sendBeacon` do Cloudflare Workeru s databází D1 (`logging/`, návod
v `logging/README.md`). Řez se ukládá přesně (střed, azimut, dosah, město, ulice, typ ulice, čas), bez IP adres
a cookies. Adresa Workeru je v proměnné repozitáře `LOG_URL`; bez ní (i lokálně) se nic neposílá. Krátké
upozornění je v patičce aplikace.

## Publikace na GitHub Pages

Aplikace umí běžet i bez serveru: v `public/config.js` je `STATIC = false` (data přes lokální server s cache)
a při nasazení se přepíše na `true`. Prohlížeč se pak ptá služeb IPR, měst, krajů a ČÚZK přímo (povolují CORS)
a dlaždice OSM a ostatní statická data čte jako soubory pod `data/`. Písmo Inter a Leaflet leží na webu
(`public/fonts/`, `public/leaflet/`), žádné Google Fonts ani unpkg. Bez serverové cache trvá každé načtení řezu
podle IPR 1–10 s.

Nasazení dělá `.github/workflows/pages.yml`: při každém pushi do `main`, ručně a každé pondělí. Nejdřív `npm test`,
pak vyrobí dlaždice OSM celé ČR z výřezu Geofabrik (týdenní kopie v cache Actions), hranice ZPS, dlaždice vývoje
zástavby, otevřená data Prahy, parkování v Brně a zóny v Plzni (při výpadku zdroje se použije soubor z minulého
nasazení), doplní klíč Mapy.com (`MAPY_KEY`, tajná proměnná) a `LOG_URL`, přidá přesměrování starých stránek měst
a vystaví vše na GitHub Pages. Dlaždice se do repozitáře neukládají. Jsou to data odvozená z OpenStreetMap, takže
na webu leží pod ODbL 1.0 (viz `data/README.txt` na webu a patičku aplikace).

## Licence a uvedení zdrojů

- Kód: MIT, © 2026 Bára Soukupová (`LICENSE` v kořeni repozitáře).
- Ilustrace: © Streetmix, CC BY-SA 4.0 (`public/streetmix/LICENSE`). Upravené ilustrace musí zůstat pod stejnou
  licencí. Ilustrace měst (`public/praha/`, `public/brno/`…): MIT jako kód. Dopravní značky: úřední díla.
- Technická mapa a MTVU: © IPR Praha; otevřená data IPR a Geoportálu Praha pod CC BY 4.0. Technické mapy měst
  a krajů a IS DMVS: veřejně přístupná data, čtou se při kliknutí a nešíří se.
- OSM: © přispěvatelé OpenStreetMap, ODbL. RÚIAN a ortofoto: © ČÚZK, CC BY 4.0.
- Export i uložený soubor uvádějí zdroje města řezu i s krajem. Podrobnosti v `LICENCE-A-ZDROJE.md`.

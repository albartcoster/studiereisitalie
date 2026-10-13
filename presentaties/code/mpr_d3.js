// MPR (proefmelkingen) per bedrijf, kenmerk kiesbaar, gefilterd op DIM en lactatie met crossfilter
// Verwacht mprData (kolommen f, t, l, b en per kenmerk som/aantal) en mprInstellingen
(function () {
  const root = d3.select("#mpr-d3");
  const inst = mprInstellingen;
  const kolommen = mprData;
  const dag_ms = 24 * 60 * 60 * 1000;

  // Kenmerken: sleutels van som (s) en aantal (n) in de data
  const kenmerken = [
    { id: "productie", knop: "Productie", as: "Productie (kg melk/koe/dag)", eenheid: " kg", dec: 1, s: "sp", n: "np", nul: true },
    { id: "vet", knop: "Vet %", as: "Vet (%)", eenheid: " %", dec: 2, s: "sv", n: "nv", nul: false },
    { id: "eiwit", knop: "Eiwit %", as: "Eiwit (%)", eenheid: " %", dec: 2, s: "se", n: "ne", nul: false },
    { id: "cellen", knop: "Celgetal", as: "Celgetal (x1000/ml)", eenheid: "", dec: 0, s: "sc", n: "nc", nul: true }
  ];
  let kenmerk = kenmerken[0];

  // Kolommen omzetten naar records voor crossfilter
  const records = kolommen.f.map((f, i) => {
    const r = { f: f, t: kolommen.t[i], l: kolommen.l[i], b: kolommen.b[i] };
    for (const k of kenmerken) { r[k.s] = kolommen[k.s][i]; r[k.n] = kolommen[k.n][i]; }
    return r;
  });

  const cf = crossfilter(records);
  const dim_lactatie = cf.dimension(d => d.l);
  const dim_dim = cf.dimension(d => d.b);
  const dim_bedrijfdag = cf.dimension(d => d.f * 100000 + d.t);
  const sleutels = kenmerken.flatMap(k => [k.s, k.n]);
  const groep = dim_bedrijfdag.group().reduce(
    (p, v) => { for (const s of sleutels) p[s] += v[s]; return p; },
    (p, v) => { for (const s of sleutels) p[s] -= v[s]; return p; },
    () => Object.fromEntries(sleutels.map(s => [s, 0]))
  );

  // Vaste kleur per bedrijf over alle grafieken (volgorde van inst.bedrijven), nooit herverdeeld bij filteren
  const bedrijven = Array.from(new Set(kolommen.f)).sort((a, b) => a - b);
  const kleuren = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
  const kleur = d3.scaleOrdinal().domain(inst.bedrijven || bedrijven).range(kleuren);
  const zichtbaar = new Set(bedrijven);

  // ---- Bediening: kenmerk, schuifregelaars en smoother in één rij boven de grafiek ----
  const bediening = root.append("div")
    .style("display", "flex").style("flex-wrap", "wrap")
    .style("gap", "0.4em 1.5em").style("justify-content", "center").style("align-items", "center")
    .style("font-size", "0.42em").style("margin-bottom", "0.3em");

  // Stijl voor de kenmerk-knoppen en de schuifregelaar met twee knoppen
  root.append("style").text(`
    #mpr-d3 .keuze { display: inline-flex; border: 1px solid #c3c2b7; border-radius: 6px; overflow: hidden; }
    #mpr-d3 .keuze button { border: none; background: #fcfcfb; color: #52514e; font: inherit; padding: 2px 10px; cursor: pointer; }
    #mpr-d3 .keuze button + button { border-left: 1px solid #c3c2b7; }
    #mpr-d3 .keuze button.actief { background: #2a78d6; color: #ffffff; }
    #mpr-d3 .dubbel { position: relative; display: inline-block; width: 150px; height: 20px; vertical-align: middle; }
    #mpr-d3 .dubbel .spoor, #mpr-d3 .dubbel .bereik { position: absolute; top: 8px; height: 4px; border-radius: 2px; }
    #mpr-d3 .dubbel .spoor { left: 0; right: 0; background: #d6d5d0; }
    #mpr-d3 .dubbel .bereik { background: #2a78d6; }
    #mpr-d3 .dubbel input { position: absolute; left: 0; top: 0; width: 100%; height: 20px; margin: 0;
      -webkit-appearance: none; appearance: none; background: none; pointer-events: none; }
    #mpr-d3 .dubbel input::-webkit-slider-runnable-track { background: none; height: 20px; }
    #mpr-d3 .dubbel input::-moz-range-track { background: none; }
    #mpr-d3 .dubbel input::-webkit-slider-thumb { -webkit-appearance: none; pointer-events: auto; cursor: pointer;
      width: 16px; height: 16px; margin-top: 2px; border-radius: 50%; background: #2a78d6; border: 2px solid #fcfcfb; box-shadow: 0 0 0 1px #2a78d6; }
    #mpr-d3 .dubbel input::-moz-range-thumb { pointer-events: auto; cursor: pointer;
      width: 12px; height: 12px; border-radius: 50%; background: #2a78d6; border: 2px solid #fcfcfb; box-shadow: 0 0 0 1px #2a78d6; }
  `);

  const keuze = bediening.append("div").attr("class", "keuze").attr("role", "group").attr("aria-label", "Kenmerk");
  const knoppen = keuze.selectAll("button").data(kenmerken).join("button")
    .text(k => k.knop)
    .on("click", (event, k) => {
      kenmerk = k;
      bereken_reeksen();
      teken();
    });

  const maak_dubbele_regelaar = (label, min, max, opmaak) => {
    const blok = bediening.append("div").style("white-space", "nowrap");
    blok.append("span").text(label + " ").style("margin-right", "0.4em");
    const regelaar = blok.append("div").attr("class", "dubbel");
    regelaar.append("div").attr("class", "spoor");
    const bereik = regelaar.append("div").attr("class", "bereik");
    const maak_invoer = (waarde, naam) => regelaar.append("input")
      .attr("type", "range").attr("min", min).attr("max", max).attr("step", 1)
      .attr("aria-label", label + " " + naam).property("value", waarde);
    const van = maak_invoer(min, "minimum");
    const tot = maak_invoer(max, "maximum");
    const getal = blok.append("strong").style("margin-left", "0.5em").style("display", "inline-block").style("min-width", "5.5em");

    const lees = () => [+van.property("value"), +tot.property("value")];
    const toon = () => {
      const [a, b] = lees();
      bereik.style("left", (a - min) / (max - min) * 100 + "%").style("width", (b - a) / (max - min) * 100 + "%");
      getal.text(opmaak(a, b));
    };
    // Knoppen mogen elkaar niet passeren
    van.on("input.grens", () => { const [a, b] = lees(); if (a > b) van.property("value", b); toon(); });
    tot.on("input.grens", () => { const [a, b] = lees(); if (b < a) tot.property("value", a); toon(); });
    toon();
    return { invoer: [van, tot], lees };
  };

  const max_klasse = inst.dim_max / inst.dim_klasse;
  const dim_tekst = (a, b) => `${a * inst.dim_klasse} – ${b >= max_klasse ? "max" : (b + 1) * inst.dim_klasse} d`;
  const lac_label = l => l >= inst.lactatie_max ? inst.lactatie_max + "+" : String(l);
  const lac_tekst = (a, b) => a === b ? lac_label(a) : `${lac_label(a)} – ${lac_label(b)}`;

  const dim_regelaar = maak_dubbele_regelaar("DIM", 0, max_klasse, dim_tekst);
  const lac_regelaar = maak_dubbele_regelaar("Lactatie", 1, inst.lactatie_max, lac_tekst);

  // Smoother: bandbreedte (sigma) van de Gaussische kernel in dagen, 0 = uit
  const smoother_blok = bediening.append("div").style("white-space", "nowrap");
  smoother_blok.append("span").text("Smoother ").style("margin-right", "0.4em");
  const smoother_invoer = smoother_blok.append("input")
    .attr("type", "range").attr("min", 0).attr("max", 120).attr("step", 5)
    .attr("aria-label", "Smoother bandbreedte in dagen")
    .style("width", "110px").style("vertical-align", "middle").style("accent-color", "#2a78d6")
    .property("value", inst.smoother_dagen);
  const smoother_getal = smoother_blok.append("strong").style("margin-left", "0.5em")
    .style("display", "inline-block").style("min-width", "3.5em");
  const smoother_sigma = () => +smoother_invoer.property("value");
  const toon_smoother = () => smoother_getal.text(smoother_sigma() === 0 ? "uit" : smoother_sigma() + " d");
  toon_smoother();

  // ---- Legenda: klik om een bedrijf aan/uit te zetten ----
  const legenda = root.append("div")
    .style("display", "flex").style("gap", "1em").style("justify-content", "center")
    .style("font-size", "0.4em").style("margin-bottom", "0.2em");

  const legenda_items = legenda.selectAll("button").data(bedrijven).join("button")
    .style("border", "none").style("background", "none").style("cursor", "pointer")
    .style("font", "inherit").style("color", "#52514e").style("padding", "0 4px")
    .on("click", (event, f) => {
      if (zichtbaar.has(f)) zichtbaar.delete(f); else zichtbaar.add(f);
      teken();
    });
  legenda_items.append("span")
    .style("display", "inline-block").style("width", "16px").style("height", "2px")
    .style("vertical-align", "middle").style("margin-right", "5px")
    .style("background", f => kleur(f));
  legenda_items.append("span").text(f => "Bedrijf " + f);

  // ---- Grafiek ----
  const breedte = 1000, hoogte = 380;
  const marge = { boven: 10, rechts: 20, onder: 28, links: 56 };

  const svg = root.append("svg")
    .attr("viewBox", `0 0 ${breedte} ${hoogte}`)
    .style("width", "100%").style("display", "block")
    .style("font-size", "13px").style("color", "#52514e");

  const alle_dagen = d3.extent(kolommen.t);
  const x = d3.scaleUtc()
    .domain([new Date(alle_dagen[0] * dag_ms), new Date(alle_dagen[1] * dag_ms)])
    .range([marge.links, breedte - marge.rechts]);
  const y = d3.scaleLinear().range([hoogte - marge.onder, marge.boven]);

  const as_x = svg.append("g").attr("transform", `translate(0,${hoogte - marge.onder})`);
  const as_y = svg.append("g").attr("transform", `translate(${marge.links},0)`);

  // Zomerperiode (juli t/m september) per jaar grijs markeren, achter raster en lijnen
  const [x_begin, x_eind] = x.domain();
  const zomers = d3.range(x_begin.getUTCFullYear(), x_eind.getUTCFullYear() + 1)
    .map(jaar => [new Date(Date.UTC(jaar, 6, 1)), new Date(Date.UTC(jaar, 9, 1))])
    .map(([van, tot]) => [van < x_begin ? x_begin : van, tot > x_eind ? x_eind : tot])
    .filter(([van, tot]) => van < tot);
  const zomer_g = svg.append("g").style("pointer-events", "none");
  zomer_g.selectAll("rect").data(zomers).join("rect")
    .attr("x", d => x(d[0])).attr("width", d => x(d[1]) - x(d[0]))
    .attr("y", marge.boven).attr("height", hoogte - marge.boven - marge.onder)
    .attr("fill", "#e8e7e2").attr("opacity", 0.6);
  zomer_g.selectAll("text").data(zomers).join("text")
    .attr("x", d => (x(d[0]) + x(d[1])) / 2).attr("y", marge.boven + 12)
    .attr("text-anchor", "middle").attr("fill", "#9a9890").style("font-size", "11px")
    .text("zomer");

  const raster = svg.append("g");
  const y_titel = svg.append("text")
    .attr("transform", "rotate(-90)").attr("x", -(hoogte - marge.onder + marge.boven) / 2).attr("y", 14)
    .attr("text-anchor", "middle").attr("fill", "currentColor").style("font-size", "12px");

  const lijnen_g = svg.append("g").attr("fill", "none").attr("stroke-width", 1).attr("stroke-opacity", 0.35);
  const punten_g = svg.append("g");
  const trend_g = svg.append("g").attr("fill", "none").attr("stroke-width", 3)
    .attr("stroke-linejoin", "round").attr("stroke-linecap", "round");
  const lijn = d3.line().x(d => x(d.datum)).y(d => y(d.waarde));

  // Crosshair + tooltip als vaste regel onder de grafiek
  const kruis = svg.append("line").attr("stroke", "#9a9890").attr("stroke-width", 1)
    .attr("y1", marge.boven).attr("y2", hoogte - marge.onder).style("display", "none");
  const tooltip = root.append("div")
    .style("visibility", "hidden").style("min-height", "2.6em")
    .style("display", "flex").style("flex-wrap", "wrap").style("justify-content", "center")
    .style("align-items", "baseline").style("gap", "0.2em 1.4em")
    .style("margin-top", "0.3em").style("padding", "4px 10px")
    .style("border-top", "1px solid #e8e7e2")
    .style("font-size", "0.38em").style("line-height", "1.4").style("color", "#0b0b0b");

  let reeksen = [];

  function bereken_reeksen() {
    // Filters: crossfilter filterRange heeft een exclusieve bovengrens
    const [dv, dt] = dim_regelaar.lees();
    const [lv, lt] = lac_regelaar.lees();
    dim_dim.filterRange([dv, dt + 1]);
    dim_lactatie.filterRange([lv, lt + 1]);

    // Proefdagen per bedrijf voor het gekozen kenmerk (groep.all() is gesorteerd op bedrijf en datum)
    const per_bedrijf = new Map(bedrijven.map(f => [f, []]));
    for (const g of groep.all()) {
      const n = g.value[kenmerk.n];
      if (n <= 0) continue;
      const f = Math.floor(g.key / 100000);
      per_bedrijf.get(f).push({ t: g.key % 100000, s: g.value[kenmerk.s], n: n });
    }
    reeksen = bedrijven.map(f => {
      const dagen = per_bedrijf.get(f);
      return { f, dagen, punten: dagen.map(d => ({ datum: new Date(d.t * dag_ms), waarde: d.s / d.n, n: d.n })) };
    });
    bereken_trends();
  }

  function bereken_trends() {
    const sigma = smoother_sigma();
    for (const r of reeksen) r.trend = sigma > 0 && r.dagen.length > 1 ? smooth(r.dagen, sigma) : [];
  }

  // Kernel-smoother (Nadaraya-Watson) met Gaussische gewichten over kalenderdagen,
  // gewogen naar het aantal koeien; geëvalueerd op een dagelijks raster tussen eerste en laatste proefdag
  function smooth(dagen, sigma) {
    const bereik = Math.ceil(3 * sigma);
    const eerste = dagen[0].t, laatste = dagen[dagen.length - 1].t;
    const stap = Math.max(1, Math.round(sigma / 10));
    const uit = [];
    let begin = 0;
    for (let t = eerste; t <= laatste; t += stap) {
      while (dagen[begin].t < t - bereik) begin++;
      let s = 0, n = 0;
      for (let j = begin; j < dagen.length && dagen[j].t <= t + bereik; j++) {
        const z = (dagen[j].t - t) / sigma;
        const w = Math.exp(-0.5 * z * z);
        s += w * dagen[j].s; n += w * dagen[j].n;
      }
      if (n > 1e-6) uit.push({ datum: new Date(t * dag_ms), waarde: s / n });
    }
    return uit;
  }

  function teken() {
    knoppen.classed("actief", k => k === kenmerk).attr("aria-pressed", k => k === kenmerk);
    y_titel.text(kenmerk.as);

    const zichtbare = reeksen.filter(r => zichtbaar.has(r.f) && r.punten.length > 0);
    const waarden = zichtbare.flatMap(r => r.punten.map(p => p.waarde));
    if (waarden.length) {
      // Productie en celgetal vanaf 0; vet en eiwit ingezoomd op het bereik
      const [lo, hi] = d3.extent(waarden);
      const rand = (hi - lo) * 0.05 || 0.1;
      y.domain(kenmerk.nul ? [0, hi * 1.05] : [lo - rand, hi + rand]).nice();
    } else {
      y.domain([0, 1]);
    }

    as_x.call(d3.axisBottom(x).ticks(8).tickSizeOuter(0));
    as_y.call(d3.axisLeft(y).ticks(6).tickSizeOuter(0));
    as_x.select(".domain").attr("stroke", "#c3c2b7");
    as_y.select(".domain").remove();
    raster.selectAll("line").data(y.ticks(6)).join("line")
      .attr("x1", marge.links).attr("x2", breedte - marge.rechts)
      .attr("y1", d => y(d)).attr("y2", d => y(d))
      .attr("stroke", "#e8e7e2").attr("stroke-width", 1);

    // Proefdagen als punten met een dunne verbindingslijn, smoother als dikke lijn
    lijnen_g.selectAll("path").data(zichtbare, r => r.f).join("path")
      .attr("stroke", r => kleur(r.f))
      .attr("d", r => lijn(r.punten));
    punten_g.selectAll("g").data(zichtbare, r => r.f).join("g")
      .attr("fill", r => kleur(r.f))
      .selectAll("circle").data(r => r.punten).join("circle")
      .attr("cx", p => x(p.datum)).attr("cy", p => y(p.waarde)).attr("r", 2.5)
      .attr("stroke", "#fcfcfb").attr("stroke-width", 1);
    trend_g.selectAll("path").data(smoother_sigma() > 0 ? zichtbare : [], r => r.f).join("path")
      .attr("stroke", r => kleur(r.f))
      .attr("d", r => lijn(r.trend));

    legenda_items.style("opacity", f => zichtbaar.has(f) ? 1 : 0.35);
  }

  // Dichtstbijzijnde proefdag per bedrijf, binnen 20 dagen van de aangewezen datum
  const zoek = d3.bisector(p => p.datum).center;
  const opmaak = w => w.toFixed(kenmerk.dec) + kenmerk.eenheid;
  svg.append("rect")
    .attr("x", marge.links).attr("y", marge.boven)
    .attr("width", breedte - marge.links - marge.rechts).attr("height", hoogte - marge.boven - marge.onder)
    .attr("fill", "transparent")
    .on("pointermove", event => {
      const [mx] = d3.pointer(event);
      const datum = x.invert(mx);
      kruis.attr("x1", mx).attr("x2", mx).style("display", null);

      tooltip.selectAll("*").remove();
      tooltip.append("div").style("color", "#52514e").style("font-weight", "bold").text(d3.utcFormat("%d-%m-%Y")(datum));
      for (const r of reeksen) {
        if (!zichtbaar.has(r.f) || r.punten.length === 0) continue;
        const p = r.punten[zoek(r.punten, datum)];
        if (Math.abs(p.datum - datum) > 20 * dag_ms) continue;
        const rij = tooltip.append("div").style("white-space", "nowrap");
        rij.append("span").style("display", "inline-block").style("width", "12px").style("height", "2px")
          .style("vertical-align", "middle").style("margin-right", "6px").style("background", kleur(r.f));
        rij.append("strong").text(opmaak(p.waarde));
        if (r.trend.length) rij.append("span").text(` (smoother ${opmaak(r.trend[zoek(r.trend, datum)].waarde)})`);
        rij.append("span").style("color", "#52514e")
          .text(` bedrijf ${r.f}, ${d3.utcFormat("%d-%m")(p.datum)}`);
      }
      tooltip.style("visibility", "visible");
    })
    .on("pointerleave", () => {
      kruis.style("display", "none");
      tooltip.style("visibility", "hidden");
    });

  for (const invoer of [...dim_regelaar.invoer, ...lac_regelaar.invoer]) {
    invoer.on("input.grafiek", () => { bereken_reeksen(); teken(); });
  }
  smoother_invoer.on("input", () => { toon_smoother(); bereken_trends(); teken(); });

  bereken_reeksen();
  teken();
})();

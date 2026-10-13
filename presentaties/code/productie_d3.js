// Productie per bedrijf per dag, gefilterd op DIM en lactatie met crossfilter
// Verwacht productieData (kolommen f, t, l, b, s, n) en productieInstellingen
(function () {
  const root = d3.select("#productie-d3");
  const inst = productieInstellingen;
  const kolommen = productieData;
  const dag_ms = 24 * 60 * 60 * 1000;

  // Kolommen omzetten naar records voor crossfilter
  const records = kolommen.f.map((f, i) => ({
    f: f, t: kolommen.t[i], l: kolommen.l[i], b: kolommen.b[i], s: kolommen.s[i], n: kolommen.n[i]
  }));

  const cf = crossfilter(records);
  const dim_lactatie = cf.dimension(d => d.l);
  const dim_dim = cf.dimension(d => d.b);
  const dim_bedrijfdag = cf.dimension(d => d.f * 100000 + d.t);
  const groep = dim_bedrijfdag.group().reduce(
    (p, v) => { p.s += v.s; p.n += v.n; return p; },
    (p, v) => { p.s -= v.s; p.n -= v.n; return p; },
    () => ({ s: 0, n: 0 })
  );

  // Vaste kleur per bedrijf over alle grafieken (volgorde van inst.bedrijven), nooit herverdeeld bij filteren
  const bedrijven = Array.from(new Set(kolommen.f)).sort((a, b) => a - b);
  const kleuren = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
  const kleur = d3.scaleOrdinal().domain(inst.bedrijven || bedrijven).range(kleuren);
  const zichtbaar = new Set(bedrijven);

  // ---- Bediening: schuifregelaars in één rij boven de grafiek ----
  const bediening = root.append("div")
    .style("display", "flex").style("flex-wrap", "wrap")
    .style("gap", "0.4em 1.5em").style("justify-content", "center").style("align-items", "center")
    .style("font-size", "0.42em").style("margin-bottom", "0.3em");

  // Stijl voor een schuifregelaar met twee knoppen: twee range-inputs over elkaar,
  // alleen de knoppen vangen de muis
  root.append("style").text(`
    #productie-d3 .dubbel { position: relative; display: inline-block; width: 170px; height: 20px; vertical-align: middle; }
    #productie-d3 .dubbel .spoor, #productie-d3 .dubbel .bereik { position: absolute; top: 8px; height: 4px; border-radius: 2px; }
    #productie-d3 .dubbel .spoor { left: 0; right: 0; background: #d6d5d0; }
    #productie-d3 .dubbel .bereik { background: #2a78d6; }
    #productie-d3 .dubbel input { position: absolute; left: 0; top: 0; width: 100%; height: 20px; margin: 0;
      -webkit-appearance: none; appearance: none; background: none; pointer-events: none; }
    #productie-d3 .dubbel input::-webkit-slider-runnable-track { background: none; height: 20px; }
    #productie-d3 .dubbel input::-moz-range-track { background: none; }
    #productie-d3 .dubbel input::-webkit-slider-thumb { -webkit-appearance: none; pointer-events: auto; cursor: pointer;
      width: 16px; height: 16px; margin-top: 2px; border-radius: 50%; background: #2a78d6; border: 2px solid #fcfcfb; box-shadow: 0 0 0 1px #2a78d6; }
    #productie-d3 .dubbel input::-moz-range-thumb { pointer-events: auto; cursor: pointer;
      width: 12px; height: 12px; border-radius: 50%; background: #2a78d6; border: 2px solid #fcfcfb; box-shadow: 0 0 0 1px #2a78d6; }
  `);

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
    .attr("type", "range").attr("min", 0).attr("max", 60).attr("step", 1)
    .attr("aria-label", "Smoother bandbreedte in dagen")
    .style("width", "120px").style("vertical-align", "middle").style("accent-color", "#2a78d6")
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
  const breedte = 1000, hoogte = 400;
  const marge = { boven: 10, rechts: 20, onder: 28, links: 50 };

  const houder = root.append("div").style("position", "relative");
  const svg = houder.append("svg")
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
  svg.append("text")
    .attr("transform", "rotate(-90)").attr("x", -(hoogte - marge.onder + marge.boven) / 2).attr("y", 14)
    .attr("text-anchor", "middle").attr("fill", "currentColor").style("font-size", "12px")
    .text(`Productie (kg melk/koe/dag, ${inst.glad_dagen}-daags gemiddelde)`);

  const lijnen_g = svg.append("g").attr("fill", "none").attr("stroke-width", 1.5);
  const trend_g = svg.append("g").attr("fill", "none").attr("stroke-width", 3)
    .attr("stroke-linejoin", "round").attr("stroke-linecap", "round");
  const lijn = d3.line().x(d => x(d.datum)).y(d => y(d.kg));

  // Crosshair + tooltip
  const kruis = svg.append("line").attr("stroke", "#9a9890").attr("stroke-width", 1)
    .attr("y1", marge.boven).attr("y2", hoogte - marge.onder).style("display", "none");
  // Tooltip als vaste regel onder de grafiek; ruimte blijft gereserveerd zodat niets verspringt
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

    // Dagtotalen per bedrijf (groep.all() is gesorteerd op sleutel, dus per bedrijf op datum)
    const per_bedrijf = new Map(bedrijven.map(f => [f, []]));
    for (const g of groep.all()) {
      if (g.value.n === 0) continue;
      const f = Math.floor(g.key / 100000);
      per_bedrijf.get(f).push({ t: g.key % 100000, s: g.value.s, n: g.value.n });
    }
    reeksen = bedrijven.map(f => ({ f, dagen: per_bedrijf.get(f), punten: glad(per_bedrijf.get(f)) }));
    bereken_trends();
  }

  function bereken_trends() {
    const sigma = smoother_sigma();
    for (const r of reeksen) r.trend = sigma > 0 ? smooth(r.dagen, sigma) : [];
  }

  // Kernel-smoother (Nadaraya-Watson) met Gaussische gewichten over kalenderdagen,
  // net als glad() gewogen naar het aantal koeien; venster afgekapt op 3 sigma
  function smooth(dagen, sigma) {
    const bereik = Math.ceil(3 * sigma);
    const uit = [];
    let begin = 0;
    for (const d of dagen) {
      while (dagen[begin].t < d.t - bereik) begin++;
      let s = 0, n = 0;
      for (let j = begin; j < dagen.length && dagen[j].t <= d.t + bereik; j++) {
        const z = (dagen[j].t - d.t) / sigma;
        const w = Math.exp(-0.5 * z * z);
        s += w * dagen[j].s; n += w * dagen[j].n;
      }
      uit.push({ datum: new Date(d.t * dag_ms), kg: s / n });
    }
    return uit;
  }

  // Voortschrijdend gemiddelde over een gecentreerd venster van glad_dagen kalenderdagen,
  // gewogen naar het aantal koeien (som productie / som koeien in het venster)
  function glad(dagen) {
    const half = Math.floor(inst.glad_dagen / 2);
    const uit = [];
    let begin = 0, eind = 0, s = 0, n = 0;
    for (const d of dagen) {
      while (eind < dagen.length && dagen[eind].t <= d.t + half) { s += dagen[eind].s; n += dagen[eind].n; eind++; }
      while (dagen[begin].t < d.t - half) { s -= dagen[begin].s; n -= dagen[begin].n; begin++; }
      uit.push({ datum: new Date(d.t * dag_ms), kg: s / n, n: d.n });
    }
    return uit;
  }

  function teken() {
    const zichtbare = reeksen.filter(r => zichtbaar.has(r.f) && r.punten.length > 0);
    const waarden = zichtbare.flatMap(r => r.punten.map(p => p.kg));
    y.domain(waarden.length ? [0, d3.max(waarden) * 1.05] : [0, 50]).nice();

    as_x.call(d3.axisBottom(x).ticks(8).tickSizeOuter(0));
    as_y.call(d3.axisLeft(y).ticks(6).tickSizeOuter(0));
    as_x.select(".domain").attr("stroke", "#c3c2b7");
    as_y.select(".domain").remove();
    raster.selectAll("line").data(y.ticks(6)).join("line")
      .attr("x1", marge.links).attr("x2", breedte - marge.rechts)
      .attr("y1", d => y(d)).attr("y2", d => y(d))
      .attr("stroke", "#e8e7e2").attr("stroke-width", 1);

    // Met smoother aan worden de 7-daagse lijnen een lichte achtergrond
    const met_trend = smoother_sigma() > 0;
    lijnen_g.attr("stroke-width", met_trend ? 1 : 1.5).attr("stroke-opacity", met_trend ? 0.3 : 1);
    lijnen_g.selectAll("path").data(zichtbare, r => r.f).join("path")
      .attr("stroke", r => kleur(r.f))
      .attr("d", r => lijn(r.punten));
    trend_g.selectAll("path").data(met_trend ? zichtbare : [], r => r.f).join("path")
      .attr("stroke", r => kleur(r.f))
      .attr("d", r => lijn(r.trend));

    legenda_items.style("opacity", f => zichtbaar.has(f) ? 1 : 0.35);
  }

  // Dichtstbijzijnde punt per bedrijf, binnen 7 dagen van de aangewezen datum
  const zoek = d3.bisector(p => p.datum).center;
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
        if (Math.abs(p.datum - datum) > 7 * dag_ms) continue;
        const rij = tooltip.append("div").style("white-space", "nowrap");
        rij.append("span").style("display", "inline-block").style("width", "12px").style("height", "2px")
          .style("vertical-align", "middle").style("margin-right", "6px").style("background", kleur(r.f));
        rij.append("strong").text(p.kg.toFixed(1) + " kg");
        if (r.trend.length) rij.append("span").text(` (smoother ${r.trend[zoek(r.trend, datum)].kg.toFixed(1)})`);
        rij.append("span").style("color", "#52514e").text(` bedrijf ${r.f}`);
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

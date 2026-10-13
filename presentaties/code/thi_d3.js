// Interactieve THI-tabel met d3.js
// THI volgens NRC (1971), klassen naar Zimbelman et al. (2009) / Collier et al.
(function () {
  const root = d3.select("#thi-d3");

  const temperaturen = d3.range(20, 41, 2);
  const luchtvochtigheden = d3.range(20, 101, 10);

  const bereken_thi = (t, rv) => (1.8 * t + 32) - (0.55 - 0.0055 * rv) * (1.8 * t - 26);

  const klassen = [
    { min: -Infinity, kleur: "#ffffff", tekst: "black", label: "geen hittestress" },
    { min: 68, kleur: "#fff3b0", tekst: "black", label: "milde stress" },
    { min: 72, kleur: "#ffc266", tekst: "black", label: "matige stress" },
    { min: 80, kleur: "#ff7a45", tekst: "black", label: "ernstige stress" },
    { min: 90, kleur: "#d62828", tekst: "white", label: "zeer ernstige stress" }
  ];
  const klasse = thi => klassen.filter(k => thi >= k.min).pop();

  // Schuifregelaars en uitkomst
  const bediening = root.append("div")
    .style("display", "flex")
    .style("gap", "1.5em")
    .style("justify-content", "center")
    .style("align-items", "center")
    .style("font-size", "0.45em")
    .style("margin-bottom", "0.4em");

  const maak_regelaar = (label, min, max, stap, waarde) => {
    const blok = bediening.append("label");
    blok.append("span").text(label + " ");
    const invoer = blok.append("input")
      .attr("type", "range")
      .attr("min", min).attr("max", max).attr("step", stap)
      .property("value", waarde)
      .style("vertical-align", "middle");
    const getal = blok.append("strong").style("margin-left", "0.3em");
    return { invoer, getal };
  };

  const temp = maak_regelaar("Temperatuur", 15, 40, 1, 28);
  const rv = maak_regelaar("Luchtvochtigheid", 10, 100, 5, 60);

  const uitkomst = bediening.append("span")
    .style("padding", "2px 10px")
    .style("border", "1px solid #999")
    .style("border-radius", "4px");

  // Tabel als SVG
  const cel_b = 64, cel_h = 22, marge_l = 60, marge_t = 26;
  const breedte = marge_l + luchtvochtigheden.length * cel_b;
  const hoogte = marge_t + temperaturen.length * cel_h;

  const svg = root.append("svg")
    .attr("viewBox", `0 0 ${breedte} ${hoogte}`)
    .style("width", breedte + "px")
    .style("max-width", "100%")
    .style("display", "block")
    .style("margin", "auto")
    .style("font-size", "12px");

  const x = d3.scaleBand().domain(luchtvochtigheden).range([marge_l, breedte]);
  const y = d3.scaleBand().domain(temperaturen).range([marge_t, hoogte]);

  svg.append("text").attr("x", 2).attr("y", 16).text("T (°C) \\ RV (%)").style("font-size", "10px");

  svg.selectAll(".kop-rv").data(luchtvochtigheden).join("text")
    .attr("x", d => x(d) + cel_b / 2).attr("y", 16)
    .attr("text-anchor", "middle").style("font-weight", "bold")
    .text(d => d);

  svg.selectAll(".kop-t").data(temperaturen).join("text")
    .attr("x", marge_l - 8).attr("y", d => y(d) + cel_h / 2 + 4)
    .attr("text-anchor", "end").style("font-weight", "bold")
    .text(d => d);

  const cellen = temperaturen.flatMap(t => luchtvochtigheden.map(r => ({ t, r, thi: bereken_thi(t, r) })));

  const cel = svg.selectAll(".cel").data(cellen).join("g")
    .attr("transform", d => `translate(${x(d.r)},${y(d.t)})`)
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => {
      temp.invoer.property("value", d.t);
      rv.invoer.property("value", d.r);
      werk_bij();
    });

  cel.append("rect")
    .attr("width", cel_b).attr("height", cel_h)
    .attr("fill", d => klasse(d.thi).kleur)
    .attr("stroke", "#ddd");

  cel.append("text")
    .attr("x", cel_b / 2).attr("y", cel_h / 2 + 4)
    .attr("text-anchor", "middle")
    .attr("fill", d => klasse(d.thi).tekst)
    .text(d => Math.round(d.thi));

  // Kader rond de cel die het dichtst bij de gekozen waarden ligt
  const kader = svg.append("rect")
    .attr("width", cel_b).attr("height", cel_h)
    .attr("fill", "none").attr("stroke", "black").attr("stroke-width", 3)
    .style("pointer-events", "none");

  const dichtstbij = (lijst, waarde) => lijst.reduce((a, b) => Math.abs(b - waarde) < Math.abs(a - waarde) ? b : a);

  function werk_bij() {
    const t = +temp.invoer.property("value");
    const r = +rv.invoer.property("value");
    const thi = bereken_thi(t, r);
    const k = klasse(thi);

    temp.getal.text(t + " °C");
    rv.getal.text(r + " %");
    uitkomst
      .style("background", k.kleur)
      .style("color", k.tekst)
      .html(`THI <strong>${Math.round(thi)}</strong> &middot; ${k.label}`);

    kader.transition().duration(150)
      .attr("x", x(dichtstbij(luchtvochtigheden, r)))
      .attr("y", y(dichtstbij(temperaturen, t)));
  }

  temp.invoer.on("input", werk_bij);
  rv.invoer.on("input", werk_bij);
  werk_bij();
})();

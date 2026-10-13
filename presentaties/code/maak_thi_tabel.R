maak_thi_tabel <- function(temperaturen = seq(20, 40, by = 2),
                           luchtvochtigheden = seq(20, 100, by = 10)) {
  # THI volgens NRC (1971): T in graden Celsius, RV in %
  bereken_thi <- function(t, rv) {
    (1.8 * t + 32) - (0.55 - 0.0055 * rv) * (1.8 * t - 26)
  }

  # Klassen naar Zimbelman et al. (2009) / Collier et al.
  klasse_kleur <- function(thi) {
    if (thi < 68) "#ffffff"
    else if (thi < 72) "#fff3b0"
    else if (thi < 80) "#ffc266"
    else if (thi < 90) "#ff7a45"
    else "#d62828"
  }

  html_output <- '<table class="thi-tabel" style="font-size:0.45em; border-collapse:collapse; margin:auto; text-align:center;">'

  # Kopregel met luchtvochtigheden
  kop <- '<tr><th style="padding:2px 6px;">T (°C) \\ RV (%)</th>'
  for (rv in luchtvochtigheden) {
    kop <- paste0(kop, sprintf('<th style="padding:2px 6px;">%d</th>', rv))
  }
  html_output <- c(html_output, paste0(kop, '</tr>'))

  # Eén rij per temperatuur
  for (t in temperaturen) {
    rij <- sprintf('<tr><th style="padding:2px 6px;">%d</th>', t)
    for (rv in luchtvochtigheden) {
      thi <- bereken_thi(t, rv)
      tekstkleur <- if (thi >= 90) "white" else "black"
      rij <- paste0(rij, sprintf('<td style="padding:2px 6px; border:1px solid #ddd; background:%s; color:%s;">%d</td>',
                                 klasse_kleur(thi), tekstkleur, round(thi)))
    }
    html_output <- c(html_output, paste0(rij, '</tr>'))
  }
  html_output <- c(html_output, '</table>')

  # Legenda
  legenda <- c(
    '<p style="font-size:0.45em; text-align:center; margin-top:0.5em;">',
    '<span style="background:#fff3b0; padding:2px 6px;">68&ndash;71 milde stress</span> ',
    '<span style="background:#ffc266; padding:2px 6px;">72&ndash;79 matige stress</span> ',
    '<span style="background:#ff7a45; padding:2px 6px;">80&ndash;89 ernstige stress</span> ',
    '<span style="background:#d62828; color:white; padding:2px 6px;">&ge; 90 zeer ernstige stress</span>',
    '</p>'
  )
  html_output <- c(html_output, legenda)

  # Als ruwe HTML-blok, zodat Pandoc er niets omheen zet
  cat("```{=html}", html_output, "```", sep = "\n")
}

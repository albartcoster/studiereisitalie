maak_thi_d3 <- function(js_bestand = "code/thi_d3.js") {
  # Interactieve THI-tabel: d3 via CDN, eigen script inline zodat Quarto het niet hoeft te kopiëren
  script <- readLines(js_bestand, encoding = "UTF-8", warn = FALSE)

  html_output <- c(
    '<div id="thi-d3"></div>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>',
    '<script>',
    script,
    '</script>'
  )

  # Als ruwe HTML-blok, zodat Pandoc er niets omheen zet
  cat("```{=html}", html_output, "```", sep = "\n")
}

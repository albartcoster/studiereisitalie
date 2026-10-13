maak_carousel <- function(image_dir, carousel_id, caption_tekst) {
  # Haal alle afbeeldingen en video's op
  bestanden <- list.files(image_dir, pattern = "\\.(jpg|jpeg|png|gif|mp4|webm|mov)$", ignore.case = TRUE)
  bestanden <- sort(bestanden)

  if (length(bestanden) == 0) {
    cat(sprintf('<p style="color:red;">Waarschuwing: Geen afbeeldingen gevonden in %s.</p>', image_dir))
    return(invisible(NULL))
  }

  # Reveal.js r-stack: alle items op elkaar, elke klik toont het volgende item
  html_output <- sprintf('<div id="carousel-%s" class="r-stack">', carousel_id)

  for (i in seq_along(bestanden)) {
    bestand <- bestanden[i]
    pad <- file.path(image_dir, bestand)
    # Eerste item direct zichtbaar, de rest als fragment dat het vorige vervangt
    klasse <- if (i == 1) "" else "fragment"
    is_video <- grepl("\\.(mp4|webm|mov)$", bestand, ignore.case = TRUE)

    if (is_video) {
      item <- sprintf('  <video class="%s" src="%s" controls muted playsinline style="max-height:500px; max-width:100%%;"></video>', klasse, pad)
    } else {
      item <- sprintf('  <img class="%s" src="%s" alt="%s" style="max-height:500px; max-width:100%%; background:white;">', klasse, pad, bestand)
    }
    html_output <- c(html_output, item)
  }

  html_output <- c(html_output, '</div>')

  # Bijschrift onder de stapel
  html_output <- c(html_output, sprintf('<p style="text-align:center; font-size:0.6em;">%s</p>', caption_tekst))

  # Als ruwe HTML-blok, zodat Pandoc er geen <p> omheen zet
  cat("```{=html}", html_output, "```", sep = "\n")
}

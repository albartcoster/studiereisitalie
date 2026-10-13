maak_mpr_d3 <- function(data_bestand = "data/data.Rdata",
                        js_bestand = "code/mpr_d3.js",
                        dim_klasse = 10,
                        dim_max = 450,
                        lactatie_max = 6,
                        smoother_dagen = 45) {
  # Laad mprdata (proefmelkingen) en aggregeer naar bedrijf x dag x lactatie x DIM-klasse.
  # Per kenmerk som en aantal apart, omdat niet elke koe elk kenmerk heeft
  e <- new.env()
  load(data_bestand, envir = e)
  if (!exists("mprdata", envir = e)) stop("mprdata niet gevonden in ", data_bestand, "; draai eerst code/data.R")

  geldig <- function(x) !is.na(x) & x > 0
  dag0 <- as.Date("1970-01-01")
  agg <- e$mprdata |>
    dplyr::filter(dim > 0) |>
    # 9999 en 32767 zijn codes voor een ontbrekend celgetal
    dplyr::mutate(cells = dplyr::if_else(cells %in% c(9999, 32767), NA_real_, as.numeric(cells))) |>
    dplyr::mutate(t = as.integer(as.Date(date_time) - dag0),
                  l = pmin(lactation, lactatie_max),
                  b = pmin(dim %/% dim_klasse, dim_max %/% dim_klasse)) |>
    dplyr::group_by(f = farms_id, t, l, b) |>
    dplyr::summarise(
      sp = round(sum(production[geldig(production)]), 1), np = sum(geldig(production)),
      sv = round(sum(fat_pct[geldig(fat_pct)]), 2),       nv = sum(geldig(fat_pct)),
      se = round(sum(protein_pct[geldig(protein_pct)]), 2), ne = sum(geldig(protein_pct)),
      sc = round(sum(cells[geldig(cells)])),              nc = sum(geldig(cells)),
      .groups = "drop") |>
    dplyr::filter(np + nv + ne + nc > 0)

  data_json <- jsonlite::toJSON(as.list(agg), auto_unbox = FALSE)
  # Alle bedrijven uit beide datasets, zodat elk bedrijf in elke grafiek dezelfde kleur heeft
  alle_bedrijven <- sort(unique(c(e$prdata$farms_id, e$mprdata$farms_id)))

  instellingen <- jsonlite::toJSON(list(bedrijven = alle_bedrijven,
                                        dim_klasse = dim_klasse,
                                        dim_max = dim_max,
                                        lactatie_max = lactatie_max,
                                        smoother_dagen = smoother_dagen),
                                   auto_unbox = TRUE)

  script <- readLines(js_bestand, encoding = "UTF-8", warn = FALSE)

  html_output <- c(
    '<div id="mpr-d3"></div>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/crossfilter2/1.5.4/crossfilter.min.js"></script>',
    sprintf('<script>const mprData = %s; const mprInstellingen = %s;</script>', data_json, instellingen),
    '<script>',
    script,
    '</script>'
  )

  # Als ruwe HTML-blok, zodat Pandoc er niets omheen zet
  cat("```{=html}", html_output, "```", sep = "\n")
}

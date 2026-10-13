maak_productie_d3 <- function(data_bestand = "data/data.Rdata",
                              js_bestand = "code/productie_d3.js",
                              dim_klasse = 10,
                              dim_max = 450,
                              lactatie_max = 6,
                              glad_dagen = 7,
                              smoother_dagen = 21) {
  # Laad prdata en aggregeer naar bedrijf x dag x lactatie x DIM-klasse,
  # zodat crossfilter in de browser niet met miljoenen koe-records hoeft te werken
  e <- new.env()
  load(data_bestand, envir = e)

  dag0 <- as.Date("1970-01-01")
  agg <- e$prdata |>
    dplyr::filter(dim > 0, production > 0) |>
    dplyr::mutate(t = as.integer(as.Date(date_time) - dag0),
                  l = pmin(lactation, lactatie_max),
                  b = pmin(dim %/% dim_klasse, dim_max %/% dim_klasse)) |>
    dplyr::group_by(f = farms_id, t, l, b) |>
    dplyr::summarise(s = round(sum(production), 1), n = dplyr::n(), .groups = "drop")

  data_json <- jsonlite::toJSON(as.list(agg), auto_unbox = FALSE)
  # Alle bedrijven uit beide datasets, zodat elk bedrijf in elke grafiek dezelfde kleur heeft
  alle_bedrijven <- sort(unique(c(e$prdata$farms_id, e$mprdata$farms_id)))

  instellingen <- jsonlite::toJSON(list(bedrijven = alle_bedrijven,
                                        dim_klasse = dim_klasse,
                                        dim_max = dim_max,
                                        lactatie_max = lactatie_max,
                                        glad_dagen = glad_dagen,
                                        smoother_dagen = smoother_dagen),
                                   auto_unbox = TRUE)

  script <- readLines(js_bestand, encoding = "UTF-8", warn = FALSE)

  html_output <- c(
    '<div id="productie-d3"></div>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/crossfilter2/1.5.4/crossfilter.min.js"></script>',
    sprintf('<script>const productieData = %s; const productieInstellingen = %s;</script>', data_json, instellingen),
    '<script>',
    script,
    '</script>'
  )

  # Als ruwe HTML-blok, zodat Pandoc er niets omheen zet
  cat("```{=html}", html_output, "```", sep = "\n")
}

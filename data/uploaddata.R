library(DBI)
library(RPostgres)
library(readxl)
library(dotenv)
library(dplyr)
library(stringr)

## session pooler ingesteld op supabase omdat wij IPv4 internet hebben en niet IPv6

# 1. Maak een voorbeeld data.frame aan om te uploaden
bestand <- 'deelnemers.xlsx'
df <- read_excel(bestand,col_names = FALSE) |> 
  dplyr::rename(naam=1,
         achternaam = 2,
         email = 3,
         telefoonnummer = 4) |> 
  mutate(telefoonnummer = str_replace_all(telefoonnummer,"^\\+","")) |> 
  mutate(telefoonnummer = str_replace_all(telefoonnummer,"^00","")) |> 
  mutate(telefoonnummer = str_replace_all(telefoonnummer,"\\s+","")) |> 
  mutate(telefoonnummer = paste0("+",telefoonnummer))


load_dot_env(".env")
for(VAR in c(
  'HOST',
  'PORT',
  'DB',
  'USER',
  'PWD')){
  assign(VAR, Sys.getenv(VAR))
  if(get(VAR) == '') stop(paste0('Missing ', VAR))
}

if(exists('con')){
  dbDisconnect(con)
  rm(con)
}
  
# 2. Maak verbinding met je Supabase database
con <- dbConnect(
  RPostgres::Postgres(),
  dbname   = DB,
  host     = HOST,
  port     = PORT ,                                   # Of 6543
  user     = USER,
  password = PWD,
  sslmode = "require" 
)


dbWriteTable(con, name = "temp_upload", value = df, row.names = FALSE, overwrite = TRUE)

# 2. Voer de UPSERT uit op basis van het conflict op (naam, achternaam)
# Let op: de automatische 'id' kolom laten we weg bij het invoegen, die genereert Supabase zelf voor nieuwe rijen.
upsert_query <- "
  INSERT INTO deelnemers (naam, achternaam, telefoonnummer,email)
  SELECT naam, achternaam, telefoonnummer,email FROM temp_upload
  ON CONFLICT (naam, achternaam) 
  DO UPDATE SET 
    telefoonnummer = EXCLUDED.telefoonnummer,
    email = EXCLUDED.email
    ;
"
dbExecute(con, upsert_query)
dbExecute(con, "DROP TABLE temp_upload;")

# 1. Maak een voorbeeld data.frame aan om te uploaden
bestand <- 'planning.xlsx'
df <- read_excel(bestand,col_names = TRUE) 
  
dbWriteTable(con, name = "temp_upload", value = df, row.names = FALSE, overwrite = TRUE)

# 2. Voer de UPSERT uit op basis van het conflict op (naam, achternaam)
# Let op: de automatische 'id' kolom laten we weg bij het invoegen, die genereert Supabase zelf voor nieuwe rijen.
upsert_query <- "
  INSERT INTO planning (datum, tijd, actie,locatie,url)
  SELECT datum, tijd, actie,locatie,url FROM temp_upload
  ON CONFLICT (datum,tijd) 
  DO UPDATE SET 
    actie = EXCLUDED.actie,
    locatie = EXCLUDED.locatie,
    url = EXCLUDED.url
    ;
"
dbExecute(con, upsert_query)




# 3. Ruim de tijdelijke tabel op
dbExecute(con, "DROP TABLE temp_upload;")
dbDisconnect(con)
rm(con)

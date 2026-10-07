library(DBI)
library(RPostgres)
library(readxl)
library(dotenv)
library(dplyr)
library(stringr)

## session pooler ingesteld op supabase omdat wij IPv4 internet hebben en niet IPv6

bestand <- 'deelnemers.xlsx'
deelnemers <- read_excel(bestand,col_names = TRUE) |> 
  dplyr::rename(naam=1,
         achternaam = 2,
         email = 3,
         telefoonnummer = 4) |> 
  mutate(telefoonnummer = str_replace_all(telefoonnummer,"^\\+","")) |> 
  mutate(telefoonnummer = str_replace_all(telefoonnummer,"^00","")) |> 
  mutate(telefoonnummer = str_replace_all(telefoonnummer,"\\s+","")) |> 
  mutate(telefoonnummer = paste0("+",telefoonnummer)) |> 
  mutate(email = tolower(email))

bestand <- 'planning.xlsx'
planning <- read_excel(bestand,col_names = TRUE) |> 
  mutate(datum = as.Date(datum),
         tijd = format(tijd,"%H:%M"))


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

dbWithTransaction(con, {
  dbWriteTable(con, name = "temp_upload1", value = deelnemers, row.names = FALSE, overwrite = TRUE)
  
  # Step A: Delete rows where the composite key (naam, achternaam) is missing in source
  delete_query1 <- "
    DELETE FROM deelnemers
    WHERE NOT EXISTS (
        SELECT 1 
        FROM temp_upload1
        WHERE temp_upload1.naam = deelnemers.naam
          AND temp_upload1.achternaam = deelnemers.achternaam
    );"
  rows_deleted1 <- dbExecute(con, delete_query1)
  
  upsert_query1 <- "
  INSERT INTO deelnemers (naam, achternaam, telefoonnummer,email)
  SELECT naam, achternaam, telefoonnummer,email
  FROM temp_upload1
  ON CONFLICT (naam, achternaam) 
  DO UPDATE SET 
    telefoonnummer = EXCLUDED.telefoonnummer,
    email = EXCLUDED.email
    ;"
  rows_upserted1 <- dbExecute(con, upsert_query1)
  dbExecute(con, "DROP TABLE temp_upload1;")
  
  dbWriteTable(con, name = "temp_upload2", value = planning, row.names = FALSE, overwrite = TRUE)
  
  delete_query2 <- "
    DELETE FROM planning
    WHERE NOT EXISTS (
        SELECT 1 
        FROM temp_upload2
        WHERE temp_upload2.datum = planning.datum
          AND temp_upload2.tijd::TIME = planning.tijd
    );"
  rows_deleted2 <- dbExecute(con, delete_query2)
  
  upsert_query2 <- "
  INSERT INTO planning (datum, tijd, actie,locatie,url)
  SELECT datum, tijd::TIME, actie,locatie,url FROM temp_upload2
  ON CONFLICT (datum,tijd) 
  DO UPDATE SET 
    actie = EXCLUDED.actie,
    locatie = EXCLUDED.locatie,
    url = EXCLUDED.url
    ;"
  rows_upserted2 <- dbExecute(con, upsert_query2)
  
  dbExecute(con, "DROP TABLE temp_upload2;")
  
})

# 3. Ruim de tijdelijke tabel op
dbDisconnect(con)
rm(con)

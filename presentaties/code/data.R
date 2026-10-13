## data voor grafieken
packages <- c("RODBC",
              "lubridate",
              "RPostgres",
              "tidyverse",
              "dotenv",
              "stringr",
              "tools",
              "stringr")
invisible(lapply(packages, library, character.only = TRUE))

path <- "C:/users/Gebruiker/OneDrive - Dairyconsult/bedrijf/Dairyconsult_Albart/punt_envs/.env_postgres"
load_dot_env(path)

for(VAR in c(
  'PG_HOST',
  'PG_DB',
  'PG_USER',
  'PG_PWD'
)){
  assign(VAR, Sys.getenv(VAR))
  if(get(VAR) == '') stop(paste0('Missing ', VAR))
}

if(!exists('pgdb') || !dbIsValid(pgdb)){
  pgdb <- dbConnect(Postgres(), host = PG_HOST, dbname = PG_DB, user = PG_USER, pass = PG_PWD)
  quer_pg <- function(...) dbGetQuery(pgdb, str_glue(paste0(...)))
  pgex <- function(...) dbExecute(pgdb, paste0(...))
}

fid <- c(
  293, ## MHFr
  301, ## LBS
  324, ## MS
  384, ## LBA
  358, ## APS
  290 ## GP
)

## Productiedata, uit productions


mindat <- '2023-01-01'
maxdat <- '2026-10-20'

sql <- glue::glue_sql("select farms_id,
                      pedigree_id,
                      date_time,
                      lactation,
                      dim,
                      birth_date,
                      calving_date,
                      production
                      from view_productions
                      where farms_id in ({fid*})
                      and date_time between {mindat} and {maxdat}",
                      .con = pgdb)

prdata <- quer_pg(sql)

sql <- glue::glue_sql("select farms_id,
                      pedigree_id,
                      date_time,
                      lactation,
                      dim,
                      birth_date,
                      calving_date,
                      production,
                      cells,
                      fat_pct,
                      protein_pct
                      from view_melkcontrole
                      where farms_id in ({fid*})
                      and date_time between {mindat} and {maxdat}",
                      .con = pgdb)

mprdata <- quer_pg(sql)





save(mprdata,prdata,file= "presentaties/data/data.Rdata")

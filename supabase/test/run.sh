#!/usr/bin/env bash
# Prova il database e i suoi permessi su un Postgres locale (serve psql e un server avviato).
# Uso:  PGHOST=... PGPORT=... ./run.sh            database nuovo con setup.sql
#       PGHOST=... PGPORT=... ./run.sh migrate    prima la versione 1.0 (base_1_0.sql), poi update_1_1.sql e update_1_2.sql
set -euo pipefail
cd "$(dirname "$0")"
DB=schede_test
MODE="${1:-fresh}"
P="psql -v ON_ERROR_STOP=1 -q -U ${PGUSER:-postgres}"
$P -d postgres -c "drop database if exists $DB" -c "create database $DB"
$P -d $DB -f stub.sql 2>&1 | grep -v "^$" || true
# estensione pg_net: nel finto ambiente c'è già lo schema net
if [ "$MODE" = migrate ]; then
  sed 's/^create extension if not exists pg_net;//' ../base_1_0.sql | $P -d $DB
  $P -d $DB -f ../update_1_1.sql
  $P -d $DB -f ../update_1_2.sql
else
  sed 's/^create extension if not exists pg_net;//' ../setup.sql | $P -d $DB
fi
$P -d $DB -f rls.test.sql
echo "(modo: $MODE)"

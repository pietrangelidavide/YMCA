#!/usr/bin/env bash
# Prova setup.sql + rls.test.sql su un Postgres locale (serve psql e un server avviato).
# Uso: PGHOST=... PGPORT=... ./run.sh
set -euo pipefail
cd "$(dirname "$0")"
DB=schede_test
psql -v ON_ERROR_STOP=1 -q -U "${PGUSER:-postgres}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -U "${PGUSER:-postgres}" -d $DB -f stub.sql 2>&1 | grep -v "^$" || true
# estensione pg_net: nel finto ambiente c'è già lo schema net
sed 's/^create extension if not exists pg_net;//' ../setup.sql | psql -v ON_ERROR_STOP=1 -q -U "${PGUSER:-postgres}" -d $DB
psql -v ON_ERROR_STOP=1 -q -U "${PGUSER:-postgres}" -d $DB -f rls.test.sql

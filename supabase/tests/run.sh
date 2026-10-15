#!/usr/bin/env bash
# يشغّل الترحيلات والاختبارات على Postgres محلي فارغ.
# الاستخدام: PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
P="psql -v ON_ERROR_STOP=1 -q"
run_db() {
  local db=$1; shift
  $P -c "drop database if exists $db" -c "create database $db" >/dev/null
  $P -d "$db" -f tests/00_supabase_shim.sql >/dev/null
  for f in migrations/*.sql; do $P -d "$db" -f "$f" >/dev/null; done
}
run_db rikaz_test
$P -d rikaz_test -f tests/10_accounting.sql | tail -4
run_db rikaz_import
$P -d rikaz_import -c "insert into auth.users (id) values ('e43ab53b-1658-47de-ab98-84ab0b1bda51')" >/dev/null
$P -d rikaz_import -f data/import_from_v1.sql >/dev/null
$P -d rikaz_import -c "select name, balance from public.treasury_balances order by name" \
  -c "select name, client_obligation, collected, client_remaining, direct_cost, gross_profit_to_date from public.project_financials" \
  -c "select name, earned, balance_due from public.technician_balances where earned > 0" \
  -c "select name, invoiced, balance_due from public.supplier_balances"

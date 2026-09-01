#!/usr/bin/env bash
set -euo pipefail

unset DATABASE_URL SUPABASE_DB_URL PGSERVICE PGSERVICEFILE PGPASSFILE
export PGHOST=127.0.0.1
export PGPORT=54322
export PGDATABASE=postgres
export PGUSER=postgres
export PGPASSWORD=postgres
export PGSSLMODE=disable
export PGCONNECT_TIMEOUT=5
export PGOPTIONS='-c statement_timeout=15000 -c lock_timeout=10000'

if [[ "$PGHOST" != "127.0.0.1" || "$PGPORT" != "54322" || "$PGDATABASE" != "postgres" || "$PGUSER" != "postgres" ]]; then
  echo "Concurrency tests refuse a non-local Supabase database." >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
background_pids=()
cleanup() {
  local pid
  for pid in "${background_pids[@]}"; do
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  done
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

query_scalar() {
  psql -X -qAt -v ON_ERROR_STOP=1 -c "$1"
}

wait_for_marker() {
  local marker="$1"
  local label="$2"
  for _ in $(seq 1 100); do
    [[ -f "$marker" ]] && return 0
    sleep 0.1
  done
  echo "Timed out waiting for transaction A in $label." >&2
  exit 1
}

assert_lock_wait() {
  local application_name="$1"
  local label="$2"
  local waiting
  for _ in $(seq 1 30); do
    waiting="$(query_scalar "SELECT count(*) FROM pg_catalog.pg_stat_activity WHERE application_name='$application_name' AND wait_event_type='Lock'")"
    if [[ "$waiting" -eq 1 ]]; then
      echo "Observed PostgreSQL lock wait for transaction B in $label."
      return 0
    fi
    sleep 0.1
  done
  echo "No PostgreSQL lock wait observed for transaction B in $label." >&2
  exit 1
}

wait_success() {
  local pid="$1"
  local log="$2"
  local label="$3"
  if ! wait "$pid"; then
    echo "$label failed unexpectedly." >&2
    sed -n '1,160p' "$log" >&2
    exit 1
  fi
}

wait_failure() {
  local pid="$1"
  local log="$2"
  local label="$3"
  local status
  set +e
  wait "$pid"
  status=$?
  set -e
  if [[ "$status" -eq 0 ]]; then
    echo "$label succeeded unexpectedly." >&2
    sed -n '1,160p' "$log" >&2
    exit 1
  fi
  if ! grep -Fq "Ce code n'est pas valide ou n'est plus disponible." "$log"; then
    echo "$label failed for an unexpected reason." >&2
    sed -n '1,160p' "$log" >&2
    exit 1
  fi
}

psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

DELETE FROM public.commercial_consents
WHERE checkout_intent_id IN (
  SELECT id FROM public.commercial_checkout_intents
  WHERE user_id IN (
    'a1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000003'
  )
);
DELETE FROM public.commercial_checkout_intents
WHERE user_id IN (
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000003'
);
DELETE FROM public.diagnostic_ia_orders
WHERE id IN (
  'a1000000-0000-4000-8000-000000000301',
  'a1000000-0000-4000-8000-000000000302'
);
DELETE FROM public.promo_redemptions
WHERE promo_code_id IN (
  'a1000000-0000-4000-8000-000000000101',
  'a1000000-0000-4000-8000-000000000102',
  'a1000000-0000-4000-8000-000000000103',
  'a1000000-0000-4000-8000-000000000104',
  'a1000000-0000-4000-8000-000000000105',
  'a1000000-0000-4000-8000-000000000106'
);
DELETE FROM public.promo_codes
WHERE id IN (
  'a1000000-0000-4000-8000-000000000101',
  'a1000000-0000-4000-8000-000000000102',
  'a1000000-0000-4000-8000-000000000103',
  'a1000000-0000-4000-8000-000000000104',
  'a1000000-0000-4000-8000-000000000105',
  'a1000000-0000-4000-8000-000000000106'
);

INSERT INTO auth.users(
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at
) VALUES
  ('a1000000-0000-4000-8000-000000000001','authenticated','authenticated','ci-race-a@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('a1000000-0000-4000-8000-000000000002','authenticated','authenticated','ci-race-b@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now()),
  ('a1000000-0000-4000-8000-000000000003','authenticated','authenticated','ci-race-c@example.test','','{"provider":"email","providers":["email"]}','{}',false,now(),now())
ON CONFLICT(id) DO NOTHING;

INSERT INTO public.profiles(id,email,role) VALUES
  ('a1000000-0000-4000-8000-000000000001','ci-race-a@example.test','user'),
  ('a1000000-0000-4000-8000-000000000002','ci-race-b@example.test','user'),
  ('a1000000-0000-4000-8000-000000000003','ci-race-c@example.test','user')
ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email, role=EXCLUDED.role;

INSERT INTO public.promo_codes(
  id,code,discount_type,discount_value,active,max_uses,max_uses_per_user
) VALUES
  ('a1000000-0000-4000-8000-000000000101','CI_MAX_ONE','percent',10,true,1,NULL),
  ('a1000000-0000-4000-8000-000000000102','CI_USER_ONE','percent',10,true,10,1),
  ('a1000000-0000-4000-8000-000000000103','CI_CONTEXT_A','percent',10,true,NULL,NULL),
  ('a1000000-0000-4000-8000-000000000104','CI_CONTEXT_B','fixed_amount',500,true,NULL,NULL),
  ('a1000000-0000-4000-8000-000000000105','CI_DIAG10','percent',10,true,NULL,NULL),
  ('a1000000-0000-4000-8000-000000000106','CI_COURSE10','percent',10,true,1,NULL);

INSERT INTO public.promo_code_targets(promo_code_id,target_type,target_key) VALUES
  ('a1000000-0000-4000-8000-000000000101','all','all'),
  ('a1000000-0000-4000-8000-000000000102','all','all'),
  ('a1000000-0000-4000-8000-000000000103','all','all'),
  ('a1000000-0000-4000-8000-000000000104','all','all'),
  ('a1000000-0000-4000-8000-000000000105','diagnostic','diagnostic-ia-express'),
  ('a1000000-0000-4000-8000-000000000106','course','formation-ia');

INSERT INTO public.diagnostic_ia_orders(
  id,user_id,customer_email,sales_context,cgv_document_version_id,
  cgv_acceptance_statement_version_id
) VALUES
  ('a1000000-0000-4000-8000-000000000301','a1000000-0000-4000-8000-000000000003',
   'ci-race-c@example.test','personal',
   (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26'),
   (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26')),
  ('a1000000-0000-4000-8000-000000000302','a1000000-0000-4000-8000-000000000003',
   'ci-race-c@example.test','personal',
   (SELECT id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26'),
   (SELECT id FROM public.legal_document_versions WHERE version='DIAGNOSTIC-CGV-ACCEPTANCE-2026-08-26'));

COMMIT;
SQL

echo "Scenario A: max_uses = 1"
marker="$tmp_dir/max-uses-a.ready"
psql -X -v ON_ERROR_STOP=1 >"$tmp_dir/max-uses-a.log" 2>&1 <<SQL &
BEGIN;
SET LOCAL ROLE service_role;
SELECT * FROM public.reserve_promo_code_for_checkout(
  'CI_MAX_ONE','a1000000-0000-4000-8000-000000000001','ci-race-a@example.test',
  'product','ci-product',10000,'ci_order','a1000000-0000-4000-8000-000000000201'
);
\! touch '$marker'
SELECT pg_sleep(3);
COMMIT;
SQL
a_pid=$!
background_pids+=("$a_pid")
wait_for_marker "$marker" "max_uses"
PGAPPNAME=lot1g_max_uses_b psql -X -v ON_ERROR_STOP=1 >"$tmp_dir/max-uses-b.log" 2>&1 <<'SQL' &
SET ROLE service_role;
SELECT * FROM public.reserve_promo_code_for_checkout(
  'CI_MAX_ONE','a1000000-0000-4000-8000-000000000002','ci-race-b@example.test',
  'product','ci-product',10000,'ci_order','a1000000-0000-4000-8000-000000000202'
);
SQL
b_pid=$!
background_pids+=("$b_pid")
assert_lock_wait "lot1g_max_uses_b" "max_uses"
wait_success "$a_pid" "$tmp_dir/max-uses-a.log" "max_uses transaction A"
wait_failure "$b_pid" "$tmp_dir/max-uses-b.log" "max_uses transaction B"
[[ "$(query_scalar "SELECT count(*) FROM public.promo_redemptions WHERE promo_code_id='a1000000-0000-4000-8000-000000000101' AND status IN ('reserved','consumed')")" == "1" ]]
echo "PASS: transaction B waited; one active redemption remains."

echo "Scenario B: max_uses_per_user = 1"
marker="$tmp_dir/per-user-a.ready"
psql -X -v ON_ERROR_STOP=1 >"$tmp_dir/per-user-a.log" 2>&1 <<SQL &
BEGIN;
SET LOCAL ROLE service_role;
SELECT * FROM public.reserve_promo_code_for_checkout(
  'CI_USER_ONE','a1000000-0000-4000-8000-000000000001','ci-race-a@example.test',
  'product','ci-product',10000,'ci_order','a1000000-0000-4000-8000-000000000203'
);
\! touch '$marker'
SELECT pg_sleep(3);
COMMIT;
SQL
a_pid=$!
background_pids+=("$a_pid")
wait_for_marker "$marker" "max_uses_per_user"
PGAPPNAME=lot1g_per_user_b psql -X -v ON_ERROR_STOP=1 >"$tmp_dir/per-user-b.log" 2>&1 <<'SQL' &
SET ROLE service_role;
SELECT * FROM public.reserve_promo_code_for_checkout(
  'CI_USER_ONE','a1000000-0000-4000-8000-000000000001','ci-race-a@example.test',
  'product','ci-product',10000,'ci_order','a1000000-0000-4000-8000-000000000204'
);
SQL
b_pid=$!
background_pids+=("$b_pid")
assert_lock_wait "lot1g_per_user_b" "max_uses_per_user"
wait_success "$a_pid" "$tmp_dir/per-user-a.log" "per-user transaction A"
wait_failure "$b_pid" "$tmp_dir/per-user-b.log" "per-user transaction B"
[[ "$(query_scalar "SELECT count(*) FROM public.promo_redemptions WHERE promo_code_id='a1000000-0000-4000-8000-000000000102' AND user_id='a1000000-0000-4000-8000-000000000001' AND status IN ('reserved','consumed')")" == "1" ]]
echo "PASS: per-user quota is serialized."

echo "Scenario C: two codes for one idempotent context"
marker="$tmp_dir/context-a.ready"
psql -X -v ON_ERROR_STOP=1 >"$tmp_dir/context-a.log" 2>&1 <<SQL &
BEGIN;
SET LOCAL ROLE service_role;
SELECT * FROM public.reserve_promo_code_for_checkout(
  'CI_CONTEXT_A','a1000000-0000-4000-8000-000000000001','ci-race-a@example.test',
  'product','ci-product',10000,'ci_order','a1000000-0000-4000-8000-000000000205'
);
\! touch '$marker'
SELECT pg_sleep(3);
COMMIT;
SQL
a_pid=$!
background_pids+=("$a_pid")
wait_for_marker "$marker" "same context"
PGAPPNAME=lot1g_same_context_b psql -X -v ON_ERROR_STOP=1 >"$tmp_dir/context-b.log" 2>&1 <<'SQL' &
SET ROLE service_role;
SELECT * FROM public.reserve_promo_code_for_checkout(
  'CI_CONTEXT_B','a1000000-0000-4000-8000-000000000001','ci-race-a@example.test',
  'product','ci-product',10000,'ci_order','a1000000-0000-4000-8000-000000000205'
);
SQL
b_pid=$!
background_pids+=("$b_pid")
assert_lock_wait "lot1g_same_context_b" "same context"
wait_success "$a_pid" "$tmp_dir/context-a.log" "same-context transaction A"
wait_failure "$b_pid" "$tmp_dir/context-b.log" "same-context transaction B"
[[ "$(query_scalar "SELECT count(*) FROM public.promo_redemptions WHERE order_context_type='ci_order' AND order_context_id='a1000000-0000-4000-8000-000000000205'")" == "1" ]]
[[ "$(query_scalar "SELECT codes.code FROM public.promo_redemptions AS redemptions JOIN public.promo_codes AS codes ON codes.id=redemptions.promo_code_id WHERE redemptions.order_context_type='ci_order' AND redemptions.order_context_id='a1000000-0000-4000-8000-000000000205'")" == "CI_CONTEXT_A" ]]
echo "PASS: one context keeps one immutable promotion configuration."

echo "Scenario D: concurrent Diagnostic checkout and redemption idempotence"
marker="$tmp_dir/diagnostic-a.ready"
psql -X -v ON_ERROR_STOP=1 >"$tmp_dir/diagnostic-a.log" 2>&1 <<SQL &
BEGIN;
SET LOCAL ROLE service_role;
SELECT * FROM public.prepare_diagnostic_promotion_checkout(
  'a1000000-0000-4000-8000-000000000301','a1000000-0000-4000-8000-000000000003',
  'ci-race-c@example.test','CI_DIAG10'
);
\! touch '$marker'
SELECT pg_sleep(3);
COMMIT;
SQL
a_pid=$!
background_pids+=("$a_pid")
wait_for_marker "$marker" "Diagnostic"
PGAPPNAME=lot1g_diagnostic_b psql -X -v ON_ERROR_STOP=1 >"$tmp_dir/diagnostic-b.log" 2>&1 <<'SQL' &
SET ROLE service_role;
SELECT * FROM public.prepare_diagnostic_promotion_checkout(
  'a1000000-0000-4000-8000-000000000301','a1000000-0000-4000-8000-000000000003',
  'ci-race-c@example.test','CI_DIAG10'
);
SQL
b_pid=$!
background_pids+=("$b_pid")
assert_lock_wait "lot1g_diagnostic_b" "Diagnostic"
wait_success "$a_pid" "$tmp_dir/diagnostic-a.log" "Diagnostic transaction A"
wait_success "$b_pid" "$tmp_dir/diagnostic-b.log" "Diagnostic transaction B"
[[ "$(query_scalar "SELECT count(*) FROM public.promo_redemptions WHERE order_context_type='diagnostic_ia_order' AND order_context_id='a1000000-0000-4000-8000-000000000301'")" == "1" ]]
diag_redemption="$(query_scalar "SELECT promo_redemption_id FROM public.diagnostic_ia_orders WHERE id='a1000000-0000-4000-8000-000000000301'")"
[[ -n "$diag_redemption" ]]
[[ "$(query_scalar "SELECT (reservation_expires_at > now() + interval '34 minutes')::text FROM public.promo_redemptions WHERE id='$diag_redemption'")" == "true" ]]
[[ "$(query_scalar "SET ROLE service_role; SELECT status FROM public.consume_promo_redemption_for_checkout('$diag_redemption','diagnostic_ia_order','a1000000-0000-4000-8000-000000000301')")" == "consumed" ]]
[[ "$(query_scalar "SET ROLE service_role; SELECT status FROM public.consume_promo_redemption_for_checkout('$diag_redemption','diagnostic_ia_order','a1000000-0000-4000-8000-000000000301')")" == "consumed" ]]
[[ "$(query_scalar "SET ROLE service_role; SELECT status FROM public.release_promo_redemption_for_checkout('$diag_redemption','diagnostic_ia_order','a1000000-0000-4000-8000-000000000301')")" == "consumed" ]]

query_scalar "SET ROLE service_role; SELECT promo_redemption_id FROM public.prepare_diagnostic_promotion_checkout('a1000000-0000-4000-8000-000000000302','a1000000-0000-4000-8000-000000000003','ci-race-c@example.test','CI_DIAG10')" >"$tmp_dir/diagnostic-release-id"
IFS= read -r diag_release_redemption < "$tmp_dir/diagnostic-release-id"
[[ -n "$diag_release_redemption" ]]
[[ "$(query_scalar "SET ROLE service_role; SELECT status FROM public.release_promo_redemption_for_checkout('$diag_release_redemption','diagnostic_ia_order','a1000000-0000-4000-8000-000000000302')")" == "released" ]]
[[ "$(query_scalar "SET ROLE service_role; SELECT status FROM public.release_promo_redemption_for_checkout('$diag_release_redemption','diagnostic_ia_order','a1000000-0000-4000-8000-000000000302')")" == "released" ]]
echo "PASS: Diagnostic reservation, double consumption and double release converge."

echo "Scenario E: concurrent course checkout_request_id"
purchases_before="$(query_scalar 'SELECT count(*) FROM public.purchases')"
accesses_before="$(query_scalar 'SELECT count(*) FROM public.course_access')"
marker="$tmp_dir/course-a.ready"
psql -X -v ON_ERROR_STOP=1 >"$tmp_dir/course-a.log" 2>&1 <<SQL &
BEGIN;
SET LOCAL ROLE service_role;
SELECT id AS cgv_id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26' LIMIT 1 \gset
SELECT id FROM public.prepare_course_checkout_intent(
  'a1000000-0000-4000-8000-000000000401','a1000000-0000-4000-8000-000000000001',
  'formation-ia','B2C_STANDARD','personal','immediate','immediate_after_payment',
  NULL::text,NULL::text,:'cgv_id'::uuid,
  jsonb_build_array(jsonb_build_object('consent_type','cgv_acceptance','legal_document_version_id',:'cgv_id')),
  'price_ci_course','prod_ci_course'
) \gset ci_
SELECT * FROM public.prepare_course_promotion_checkout(
  :'ci_id'::uuid,'a1000000-0000-4000-8000-000000000001','ci-race-a@example.test',
  'formation-ia',49700,'CI_COURSE10'
);
\! touch '$marker'
SELECT pg_sleep(3);
COMMIT;
SQL
a_pid=$!
background_pids+=("$a_pid")
wait_for_marker "$marker" "course checkout_request_id"
PGAPPNAME=lot1g_course_b psql -X -v ON_ERROR_STOP=1 >"$tmp_dir/course-b.log" 2>&1 <<'SQL' &
BEGIN;
SET LOCAL ROLE service_role;
SELECT id AS cgv_id FROM public.legal_document_versions WHERE version='CGV-B2C-2026-08-26' LIMIT 1 \gset
SELECT id FROM public.prepare_course_checkout_intent(
  'a1000000-0000-4000-8000-000000000401','a1000000-0000-4000-8000-000000000001',
  'formation-ia','B2C_STANDARD','personal','immediate','immediate_after_payment',
  NULL::text,NULL::text,:'cgv_id'::uuid,
  jsonb_build_array(jsonb_build_object('consent_type','cgv_acceptance','legal_document_version_id',:'cgv_id')),
  'price_ci_course','prod_ci_course'
) \gset ci_
SELECT * FROM public.prepare_course_promotion_checkout(
  :'ci_id'::uuid,'a1000000-0000-4000-8000-000000000001','ci-race-a@example.test',
  'formation-ia',49700,'CI_COURSE10'
);
COMMIT;
SQL
b_pid=$!
background_pids+=("$b_pid")
assert_lock_wait "lot1g_course_b" "course checkout_request_id"
wait_success "$a_pid" "$tmp_dir/course-a.log" "course transaction A"
wait_success "$b_pid" "$tmp_dir/course-b.log" "course transaction B"
[[ "$(query_scalar "SELECT count(*) FROM public.commercial_checkout_intents WHERE user_id='a1000000-0000-4000-8000-000000000001' AND checkout_request_id='a1000000-0000-4000-8000-000000000401'")" == "1" ]]
course_intent="$(query_scalar "SELECT id FROM public.commercial_checkout_intents WHERE user_id='a1000000-0000-4000-8000-000000000001' AND checkout_request_id='a1000000-0000-4000-8000-000000000401'")"
[[ "$(query_scalar "SELECT count(*) FROM public.promo_redemptions WHERE order_context_type='commercial_checkout_intent' AND order_context_id='$course_intent'")" == "1" ]]
[[ "$(query_scalar "SELECT count(*) FROM public.commercial_consents WHERE checkout_intent_id='$course_intent'")" == "1" ]]
[[ "$(query_scalar "SELECT count(*) FROM public.purchases")" == "$purchases_before" ]]
[[ "$(query_scalar "SELECT count(*) FROM public.course_access")" == "$accesses_before" ]]
[[ "$(query_scalar "SELECT (reservation_expires_at > now() + interval '34 minutes')::text FROM public.promo_redemptions WHERE order_context_id='$course_intent'")" == "true" ]]
echo "PASS: one course intent, one consent set, one quota reservation and no pre-payment LMS right."

echo "Promotion concurrency validation: PASS"

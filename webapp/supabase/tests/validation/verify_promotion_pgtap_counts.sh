#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
tests_dir="$(cd -- "$script_dir/.." && pwd)"

declare -A expected=(
  [promotion_engine.sql]=78
  [diagnostic_promotion_integration.sql]=43
  [course_promotion_integration.sql]=53
  [promotion_administration.sql]=56
)

ordered_files=(
  promotion_engine.sql
  diagnostic_promotion_integration.sql
  course_promotion_integration.sql
  promotion_administration.sql
)

count_assertions() {
  local file="$1"
  awk '
    BEGIN { IGNORECASE = 1; count = 0 }
    /^[[:space:]]*SELECT[[:space:]]+(extensions[.])?(ok|is|isnt|cmp_ok|throws_ok|lives_ok|has_table|has_column|has_function|function_privs_are)[[:space:]]*[(]/ {
      count++
    }
    END { print count }
  ' "$file"
}

total=0
for filename in "${ordered_files[@]}"; do
  path="$tests_dir/$filename"
  if [[ ! -f "$path" ]]; then
    echo "Missing pgTAP suite: $path" >&2
    exit 1
  fi

  actual="$(count_assertions "$path")"
  wanted="${expected[$filename]}"
  printf '%-46s %3d assertions\n' "$filename" "$actual"
  if [[ "$actual" -ne "$wanted" ]]; then
    echo "Unexpected pgTAP inventory for $filename: expected $wanted, found $actual." >&2
    exit 1
  fi
  total=$((total + actual))
done

if [[ "$total" -ne 230 ]]; then
  echo "Unexpected LOT 1G pgTAP total: expected 230, found $total." >&2
  exit 1
fi

echo "LOT 1G pgTAP inventory: $total assertions present; runtime execution still required."

#!/usr/bin/env bash
# Print a DATABASE_URL for Aurora DSQL using IAM (admin role). Requires AWS CLI v2
# with `aws dsql` and credentials allowed to call dsql:DbConnectAdmin on the cluster.
#
# Prefer: pnpm run db:migrate
# Manual psql/client usage:
#   export DSQL_ENDPOINT="<value from CDK DatabaseEndpoint output>"
#   export DSQL_REGION=eu-west-1   # optional if AWS_REGION is set
#   eval "$(pnpm run -s db:dsql-url)"
#   psql "$DATABASE_URL"
#
set -euo pipefail

REGION="${DSQL_REGION:-${AWS_REGION:-}}"
if [[ -z "$REGION" ]]; then
  echo "Set DSQL_REGION or AWS_REGION" >&2
  exit 1
fi

RAW_HOST="${DSQL_ENDPOINT:?Set DSQL_ENDPOINT to the cluster endpoint hostname}"
# Strip optional scheme (CLI expects hostname only)
HOST="${RAW_HOST#https://}"
HOST="${HOST#http://}"
HOST="${HOST%%/*}"

EXPIRES="${DSQL_TOKEN_EXPIRES:-900}"

TOKEN=$(aws dsql generate-db-connect-admin-auth-token \
  --region "$REGION" \
  --hostname "$HOST" \
  --expires-in "$EXPIRES")

# URL-encode token for use as password in a postgres URL
ENC=$(TOKEN="$TOKEN" node -e 'console.log(encodeURIComponent(process.env.TOKEN ?? ""))')

echo "export DATABASE_URL=postgresql://admin:${ENC}@${HOST}:5432/postgres?sslmode=require"

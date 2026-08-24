#!/usr/bin/env bash
set -u
base=http://127.0.0.1:3001
stage_db=kataloghoz_b2b_stage
product_id=$(runuser -u postgres -- psql -d "$stage_db" -Atc "SELECT id FROM \"Product\" WHERE \"priceWithVat\"=10 AND \"unitsPerPackage\"=12 LIMIT 1")
echo "db_event_count=$(runuser -u postgres -- psql -d "$stage_db" -Atc "SELECT count(*) FROM \"AnalyticsEvent\" WHERE \"eventId\"='stage-event-1'")"
event='{"eventName":"product_viewed","eventId":"stage-event-1","visitorId":"stage-visitor","sessionId":"stage-session","productId":"PRODUCT_ID","contentIds":["stage-product"],"isTest":true}'
event=${event/PRODUCT_ID/$product_id}
curl -sS -w '\nstatus=%{http_code}\n' -H 'Content-Type: application/json' --data "$event" "$base/api/analytics"

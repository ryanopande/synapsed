#!/usr/bin/env bash
# Starts the permanent LOCAL study database (a one-node MongoDB replica set) on port 27019.
# Data lives in ~/synapsed-study-db so it survives restarts. Safe to run repeatedly.
# Why a replica set: the app (Prisma) needs one for transactions, which pathway editing uses.
set -euo pipefail
DB_DIR="$HOME/synapsed-study-db"; PORT=27019
mkdir -p "$DB_DIR/data"
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "study database already running on port $PORT"
else
  nohup mongod --dbpath "$DB_DIR/data" --port $PORT --bind_ip 127.0.0.1 --replSet rs0 --logpath "$DB_DIR/mongod.log" >/dev/null 2>&1 &
  for i in 1 2 3 4 5 6 7 8; do mongosh --quiet --port $PORT --eval 'db.hello().ok' >/dev/null 2>&1 && break; sleep 1; done
  mongosh --quiet --port $PORT --eval 'try { rs.status().ok } catch (e) { rs.initiate({_id:"rs0", members:[{_id:0, host:"127.0.0.1:'$PORT'"}]}).ok }' >/dev/null
  for i in 1 2 3 4 5 6 7 8; do [ "$(mongosh --quiet --port $PORT --eval 'db.hello().isWritablePrimary')" = "true" ] && break; sleep 1; done
  echo "study database started on port $PORT (data: $DB_DIR/data)"
fi
echo "DATABASE_URL=mongodb://127.0.0.1:$PORT/synapsed_study1?replicaSet=rs0&directConnection=true"

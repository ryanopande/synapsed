#!/usr/bin/env bash
# Writes the "why this node" explanations for every pathway in the study class that has none, one at a time.
# Needs the app running. It does not change any pathway. Safe to re-run (it skips ones already explained).
#   bash study/study1_instructor/explain_missing.sh            # do it
#   bash study/study1_instructor/explain_missing.sh --dry-run  # only list what is missing
set -euo pipefail
PORT="${MONGO_PORT:-27019}"; DBNAME="${MONGO_DB:-synapsed_study1}"; BASE="${SYNAPSED_BASE_URL:-http://localhost:3000}"
IDS=$(mongosh --quiet --port "$PORT" "$DBNAME" --eval 'db.LearningPathway.find({rationaleSummary: null}).forEach(p => {
  const u = db.User.findOne({_id: ObjectId(p.studentId)}); print(p._id.toString() + " " + (u ? u.email.replace("study-","").replace("@synapsed.study.local","") : "?")) })')
[ -n "$IDS" ] || { echo "Every pathway already has an explanation."; exit 0; }
echo "Pathways without an explanation:"; echo "$IDS" | sed 's/^/  /'
[ "${1:-}" = "--dry-run" ] && exit 0
echo "$IDS" | while read -r ID NAME; do
  printf "explaining %s ... " "$NAME"
  RES=$(curl -s -m 900 -X POST "$BASE/api/learning-paths/$ID/explain" || echo '{"ok":false,"error":"no answer"}')
  echo "$RES" | python3 -c "import sys,json;d=json.load(sys.stdin);print('ok' if d.get('ok') else 'FAILED: '+str(d.get('error'))[:90], '| explained', d.get('explained'),'/',d.get('total'),'| unverified quotes', d.get('unverifiedEvidence'))" 2>/dev/null || echo "FAILED (unreadable answer)"
done

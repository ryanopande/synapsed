#!/usr/bin/env bash
# One-command setup of the Study 1 class. Run from the repo root, with the study database up and the app running:
#   bash study/study1_instructor/setup_study_class.sh <the Google email you signed in with>
# It (1) finds your educator account, (2) creates the class "AI Literacy (Study 1)" owned by you with the
# 12 simulated students and their survey answers, (3) attaches the AI Literacy syllabus. Safe to re-run:
# if the class already exists it does NOT create another. It never touches any database but the study one.
set -euo pipefail
cd "$(dirname "$0")/../.."

EMAIL="${1:-}"
[[ "$EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$ ]] || { echo "usage: bash study/study1_instructor/setup_study_class.sh <the Google email you signed in with>"; exit 1; }
PORT="${MONGO_PORT:-27019}"; DBNAME="${MONGO_DB:-synapsed_study1}"
export DATABASE_URL="${DATABASE_URL:-mongodb://127.0.0.1:$PORT/$DBNAME?replicaSet=rs0&directConnection=true}"
export SYNAPSED_BASE_URL="${SYNAPSED_BASE_URL:-http://localhost:3000}"
CLASS_TITLE="AI Literacy (Study 1)"
mq() { mongosh --quiet --port "$PORT" "$DBNAME" --eval "$1" | tail -1; }

echo "Using database: $DBNAME on port $PORT"
mq 'db.hello().isWritablePrimary' | grep -q true || { echo "The study database isn't running. Start it: bash study/study1_instructor/start_study_db.sh"; exit 1; }

# 1) the educator account must already exist in THIS database and be a professor
INFO=$(mq "const u=db.User.findOne({email:'$EMAIL'}); print(u ? u._id.toString()+' '+(u.role||'none') : 'NONE')")
if [ "$INFO" = "NONE" ]; then
  echo "No account for $EMAIL in the study database yet."
  echo "Open $SYNAPSED_BASE_URL, sign in with that Google account and choose the Professor role, then run this again."; exit 1
fi
PROF="${INFO%% *}"; ROLE="${INFO#* }"
if [ "$ROLE" != "PROFESSOR" ]; then
  echo "$EMAIL is registered as '$ROLE', not PROFESSOR."
  echo "Sign out, sign in again, choose the Professor role (or tell me and I'll fix it), then run this again."; exit 1
fi
echo "Educator account found: $EMAIL"

# 2) the class (created once)
CLASS=$(mq "const c=db.Class.findOne({title:'$CLASS_TITLE', professorId: ObjectId('$PROF')}); print(c ? c._id.toString() : 'NONE')")
if [ "$CLASS" != "NONE" ]; then
  echo "The study class already exists ($CLASS), so I'm not creating another."
else
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "$SYNAPSED_BASE_URL" || true)
  [ "$CODE" = "200" ] || [ "$CODE" = "307" ] || [ "$CODE" = "308" ] || { echo "The app isn't answering at $SYNAPSED_BASE_URL (got '$CODE'). Start it with: npm run dev"; exit 1; }
  sed -i '' "s/^STUDY_PROFESSOR_ID=.*/STUDY_PROFESSOR_ID=$PROF/" study/.env
  echo "Creating the class with the 12 simulated students..."
  (cd study && env -u STUDY_CLASS_ID .venv/bin/python study1_instructor/seed_study1.py)
  CLASS=$(python3 -c "import json;print(json.load(open('study/study1_instructor/seed_result.json'))['classId'])")
fi

# 3) the syllabus
node --env-file=.env study/study1_instructor/attach_syllabus.mjs "$CLASS"

echo
echo "DONE. Class id: $CLASS"
echo "Open:  $SYNAPSED_BASE_URL/teacher/classes/$CLASS?tab=survey-learning-path"
echo "Next:  click Learning Paths > Student Progress > Generate (all 12 students), then review the three core cases."

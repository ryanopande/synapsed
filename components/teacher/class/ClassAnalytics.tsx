"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { AlertTriangle, CheckCircle2, Clock, MessageSquare, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DashboardMetrics } from "@/components/teacher/assessments/DashboardMetrics"
import { StudentAssessmentList } from "@/components/teacher/assessments/StudentAssessmentList"
import { StudentFeedbackDialog } from "@/components/teacher/class/dialogs/StudentFeedbackDialog"
import type { Quiz } from "@/components/teacher/assessments/types"
import type { ClassAnalytics as ClassAnalyticsData, EngagementStatus, RiskFlag, StudentAnalytics } from "@/lib/analytics/classAnalytics"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to load analytics")
  return res.json()
}

const RISK_LABELS: Record<RiskFlag, string> = {
  inactive: "No activity in 14+ days",
  "low-scores": "Average score below 60%",
  "missed-quizzes": "Missed quizzes past due",
  "low-pathway-progress": "Under 25% of pathway done",
}

const ENGAGEMENT: Record<EngagementStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 },
  quiet: { label: "Quiet", className: "bg-amber-100 text-amber-800", Icon: Clock },
  inactive: { label: "Inactive", className: "bg-red-100 text-red-800", Icon: AlertTriangle },
}

const pct = (value: number | null) => (value === null ? "–" : `${value}%`)

function formatRelative(iso: string | null) {
  if (!iso) return "Never"
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  return `${days} days ago`
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
        {detail && <p className="text-xs text-muted-foreground mt-1">{detail}</p>}
      </CardContent>
    </Card>
  )
}

/** Single-series horizontal bars: one hue, value labelled in text ink, tooltip on hover. */
function BarList({
  rows,
  max,
  format,
}: {
  rows: { key: string; label: string; value: number; tooltip: string; display: string }[]
  max: number
  format?: "percent"
}) {
  const scaleMax = format === "percent" ? 100 : Math.max(max, 1)
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key} title={row.tooltip} className="space-y-1">
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate text-gray-700">{row.label}</span>
            <span className="shrink-0 font-medium text-gray-900">{row.display}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100">
            <div
              className="h-2.5 rounded-full bg-emerald-600 transition-all"
              style={{ width: `${Math.min(100, (row.value / scaleMax) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function EngagementBadge({ status }: { status: EngagementStatus }) {
  const { label, className, Icon } = ENGAGEMENT[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

type SortKey = "name" | "lastActivity" | "pathway" | "score"

export function ClassAnalytics({ classId }: { classId: string }) {
  const { data, error, isLoading, mutate, isValidating } = useSWR<ClassAnalyticsData>(
    `/api/professor/analytics/${classId}`,
    fetcher,
    { revalidateOnFocus: false }
  )
  const { data: quizData } = useSWR<{ quizzes: Quiz[] }>(`/api/professor/quizzes/${classId}`, fetcher, {
    revalidateOnFocus: false,
  })
  const [feedbackStudent, setFeedbackStudent] = useState<{ id: string; name: string } | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("lastActivity")

  const sortedStudents = useMemo(() => {
    const list = [...(data?.students ?? [])]
    const num = (v: number | null) => (v === null ? -1 : v)
    list.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name)
        case "pathway":
          return num(a.pathway.percent) - num(b.pathway.percent)
        case "score":
          return num(a.averageScore) - num(b.averageScore)
        default:
          return (
            new Date(a.engagement.lastActivity ?? 0).getTime() - new Date(b.engagement.lastActivity ?? 0).getTime()
          )
      }
    })
    return list
  }, [data?.students, sortKey])

  if (isLoading) {
    return <p className="text-muted-foreground py-8">Loading analytics...</p>
  }
  if (error || !data) {
    return <p className="text-destructive py-8">Could not load analytics. Please refresh the page.</p>
  }

  const { overview, assessments, pathways } = data
  const atRisk = data.students
    .filter((s) => s.riskFlags.length >= 2)
    .sort((a, b) => b.riskFlags.length - a.riskFlags.length)
  const watch = data.students.filter((s) => s.riskFlags.length === 1)
  const maxBucket = Math.max(...assessments.scoreDistribution.map((b) => b.count))
  const scoredQuizzes = assessments.quizzes.filter((q) => q.averageScore !== null)

  const SortHead = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <TableHead>
      <button
        type="button"
        onClick={() => setSortKey(k)}
        className={`text-left ${sortKey === k ? "font-semibold text-gray-900" : ""}`}
      >
        {children}
        {sortKey === k ? " ↑" : ""}
      </button>
    </TableHead>
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Engagement, assessment performance and pathway progress for {data.className}.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isValidating} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Active this week"
          value={`${overview.activeStudents}/${overview.students}`}
          detail="Students with activity in the last 7 days"
        />
        <StatTile label="Average pathway completion" value={pct(overview.averagePathwayPercent)} />
        <StatTile
          label="Average score"
          value={pct(overview.averageScore)}
          detail="Professor quizzes and pop quizzes"
        />
        <StatTile
          label="At-risk students"
          value={String(overview.atRiskStudents)}
          detail={`${watch.length} more to watch`}
        />
      </div>

      {/* At-risk */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            At-risk students
          </CardTitle>
          <CardDescription>
            Students showing two or more warning signs: {Object.values(RISK_LABELS).join(", ").toLowerCase()}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {atRisk.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No students are at risk right now.
              {watch.length > 0 && ` ${watch.length} student${watch.length === 1 ? " shows" : "s show"} one warning sign.`}
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {atRisk.map((s) => (
                <li key={s.studentId} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{s.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.riskFlags.map((flag) => (
                        <span
                          key={flag}
                          className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-800"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {RISK_LABELS[flag]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => setFeedbackStudent({ id: s.studentId, name: s.name })}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Give feedback
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Engagement */}
      <Card>
        <CardHeader>
          <CardTitle>Student engagement</CardTitle>
          <CardDescription>
            Active = activity in the last 7 days, quiet = 8–14 days, inactive = longer or never. Click a column to sort.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students enrolled yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead k="name">Student</SortHead>
                    <TableHead>Status</TableHead>
                    <SortHead k="lastActivity">Last activity</SortHead>
                    <TableHead className="text-right">Active days (14d)</TableHead>
                    <TableHead className="text-right">Tutor messages</TableHead>
                    <TableHead className="text-right">Notes</TableHead>
                    <SortHead k="pathway">Pathway</SortHead>
                    <SortHead k="score">Avg score</SortHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedStudents.map((s: StudentAnalytics) => (
                    <TableRow key={s.studentId}>
                      <TableCell>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </TableCell>
                      <TableCell>
                        <EngagementBadge status={s.engagement.status} />
                      </TableCell>
                      <TableCell>{formatRelative(s.engagement.lastActivity)}</TableCell>
                      <TableCell className="text-right">{s.engagement.activeDays14}</TableCell>
                      <TableCell className="text-right">
                        {s.engagement.tutorMessages}
                        <span className="text-xs text-muted-foreground"> / {s.engagement.conversations} chats</span>
                      </TableCell>
                      <TableCell className="text-right">{s.engagement.lessonNotes}</TableCell>
                      <TableCell>
                        {s.pathway.status === "approved"
                          ? `${s.pathway.completed}/${s.pathway.total} · ${pct(s.pathway.percent)}`
                          : s.pathway.status === "none"
                            ? "No pathway"
                            : s.pathway.status.charAt(0).toUpperCase() + s.pathway.status.slice(1)}
                      </TableCell>
                      <TableCell>{pct(s.averageScore)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assessment performance */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Assessment performance</h2>
          <p className="text-sm text-muted-foreground">Professor quizzes and AI tutor pop quizzes.</p>
        </div>

        {quizData?.quizzes && <DashboardMetrics quizzes={quizData.quizzes} />}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Score distribution</CardTitle>
              <CardDescription>All scored professor quizzes and pop quizzes</CardDescription>
            </CardHeader>
            <CardContent>
              {maxBucket === 0 ? (
                <p className="text-sm text-muted-foreground">No scores yet.</p>
              ) : (
                <BarList
                  max={maxBucket}
                  rows={assessments.scoreDistribution.map((b) => ({
                    key: b.label,
                    label: b.label,
                    value: b.count,
                    display: String(b.count),
                    tooltip: `${b.count} score${b.count === 1 ? "" : "s"} in ${b.label}`,
                  }))}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quiz averages over time</CardTitle>
              <CardDescription>Published quizzes, oldest first</CardDescription>
            </CardHeader>
            <CardContent>
              {scoredQuizzes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No quiz submissions yet.</p>
              ) : (
                <BarList
                  max={100}
                  format="percent"
                  rows={scoredQuizzes.map((q) => ({
                    key: q.quizId,
                    label: q.title,
                    value: q.averageScore ?? 0,
                    display: pct(q.averageScore),
                    tooltip: `${q.title}: average ${pct(q.averageScore)} from ${q.submissions} submission${q.submissions === 1 ? "" : "s"}`,
                  }))}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most missed questions</CardTitle>
            <CardDescription>Professor quiz questions with the lowest share of correct answers</CardDescription>
          </CardHeader>
          <CardContent>
            {assessments.mostMissedQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No missed questions yet.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {assessments.mostMissedQuestions.map((q) => (
                  <li key={q.questionId} className="flex items-start justify-between gap-4 p-3">
                    <div className="min-w-0">
                      <p className="text-sm">{q.text || "Untitled question"}</p>
                      <p className="text-xs text-muted-foreground">{q.quizTitle}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{q.correctPercent}% correct</p>
                      <p className="text-xs text-muted-foreground">
                        {q.answers} answer{q.answers === 1 ? "" : "s"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-2">
          <h3 className="text-base font-semibold">Pop quiz results by student</h3>
          <StudentAssessmentList classId={classId} />
        </div>
      </section>

      {/* Pathway progress */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Learning pathway progress</h2>
          <p className="text-sm text-muted-foreground">Lessons students have marked complete in their pathways.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Approved pathways" value={String(pathways.statusCounts.approved)} />
          <StatTile label="Pending approval" value={String(pathways.statusCounts.pending)} />
          <StatTile label="Rejected" value={String(pathways.statusCounts.rejected)} />
          <StatTile label="No pathway yet" value={String(pathways.statusCounts.none)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Completion by difficulty</CardTitle>
              <CardDescription>Share of lessons completed across approved pathways</CardDescription>
            </CardHeader>
            <CardContent>
              {pathways.completionByDifficulty.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approved pathways yet.</p>
              ) : (
                <BarList
                  max={100}
                  format="percent"
                  rows={pathways.completionByDifficulty.map((d) => ({
                    key: d.difficulty,
                    label: d.difficulty.charAt(0).toUpperCase() + d.difficulty.slice(1),
                    value: d.percent ?? 0,
                    display: `${d.completed}/${d.total} · ${pct(d.percent)}`,
                    tooltip: `${d.completed} of ${d.total} ${d.difficulty} lessons completed`,
                  }))}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hardest lessons</CardTitle>
              <CardDescription>Lowest average pop quiz score</CardDescription>
            </CardHeader>
            <CardContent>
              {pathways.hardestLessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pop quizzes taken yet.</p>
              ) : (
                <BarList
                  max={100}
                  format="percent"
                  rows={pathways.hardestLessons.map((l) => ({
                    key: l.title,
                    label: l.title,
                    value: l.averageScore,
                    display: `${l.averageScore}%`,
                    tooltip: `${l.title}: average ${l.averageScore}% over ${l.attempts} attempt${l.attempts === 1 ? "" : "s"}`,
                  }))}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progress by student</CardTitle>
          </CardHeader>
          <CardContent>
            {data.students.every((s) => s.pathway.status !== "approved") ? (
              <p className="text-sm text-muted-foreground">No approved pathways yet.</p>
            ) : (
              <BarList
                max={100}
                format="percent"
                rows={data.students
                  .filter((s) => s.pathway.status === "approved")
                  .sort((a, b) => (b.pathway.percent ?? 0) - (a.pathway.percent ?? 0))
                  .map((s) => ({
                    key: s.studentId,
                    label: s.name,
                    value: s.pathway.percent ?? 0,
                    display: `${s.pathway.completed}/${s.pathway.total} · ${pct(s.pathway.percent)}`,
                    tooltip: `${s.name}: ${s.pathway.completed} of ${s.pathway.total} lessons completed`,
                  }))}
              />
            )}
          </CardContent>
        </Card>
      </section>

      <StudentFeedbackDialog
        classId={classId}
        student={feedbackStudent}
        onOpenChange={(open) => {
          if (!open) setFeedbackStudent(null)
        }}
      />
    </div>
  )
}

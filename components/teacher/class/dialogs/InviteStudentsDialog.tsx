"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { useSession } from "@/lib/auth/client"
import { toast } from "sonner"
import { Copy, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface InviteStudentsDialogProps {
  classId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Emails of students already in the class; they are skipped. */
  enrolledEmails: string[]
}

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to load class")
  return res.json()
}

/** Split pasted text (commas, semicolons, spaces, new lines, "Name <email>") into emails. */
function parseEmails(raw: string, enrolled: Set<string>) {
  const tokens = raw
    .split(/[\s,;]+/)
    .map((t) => t.replace(/^[<"'(]+|[>"')]+$/g, "").toLowerCase())
    // Words without "@" are names from "Jane Doe <jane@x.edu>" style pastes, not emails.
    .filter((t) => t.includes("@"))
  const valid: string[] = []
  const invalid: string[] = []
  const alreadyEnrolled: string[] = []
  for (const t of new Set(tokens)) {
    if (!EMAIL.test(t)) invalid.push(t)
    else if (enrolled.has(t)) alreadyEnrolled.push(t)
    else valid.push(t)
  }
  return { valid, invalid, alreadyEnrolled }
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied`)
  } catch {
    toast.error(`Couldn't copy ${what.toLowerCase()}`)
  }
}

export function InviteStudentsDialog({ classId, open, onOpenChange, enrolledEmails }: InviteStudentsDialogProps) {
  const { data: session } = useSession()
  const [raw, setRaw] = useState("")
  const { data: cls } = useSWR<{ title: string; joinToken: string }>(open ? `/api/class/${classId}` : null, fetcher)

  const enrolled = useMemo(() => new Set(enrolledEmails.map((e) => e.toLowerCase())), [enrolledEmails])
  const { valid, invalid, alreadyEnrolled } = useMemo(() => parseEmails(raw, enrolled), [raw, enrolled])

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const joinLink = cls ? `${origin}/student/join?token=${encodeURIComponent(cls.joinToken)}` : ""
  const professorName = session?.user?.name ?? "Your professor"
  const professorEmail = session?.user?.email ?? ""
  const subject = cls ? `Join ${cls.title} on SynapsEd` : ""
  const body = cls
    ? [
        "Hi,",
        "",
        `You're invited to join ${cls.title} on SynapsEd.`,
        "",
        `1. Open this link: ${joinLink}`,
        "2. Sign in with your Google account (choose the Student role if asked).",
        "3. Click Join Class.",
        "",
        `If the link doesn't work, go to ${origin}/student/join and enter this class code: ${cls.joinToken}`,
        "",
        "See you in class,",
        professorName,
      ].join("\n")
    : ""

  const bcc = valid.join(",")
  const gmailUrl =
    "https://mail.google.com/mail/?" +
    new URLSearchParams({
      view: "cm",
      fs: "1",
      // The professor's own address goes in To: (a copy for their records, and less spam-like than an
      // empty To:); students stay in BCC so they don't see each other's emails.
      ...(professorEmail ? { authuser: professorEmail, to: professorEmail } : {}),
      bcc,
      su: subject,
      body,
    }).toString()
  // Very long compose links can be rejected by the mail client; fall back to copying.
  const tooLong = gmailUrl.length > 7000

  const handleOpenChange = (next: boolean) => {
    if (!next) setRaw("")
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite students</DialogTitle>
          <DialogDescription>
            Paste student emails, then send the invite from your Gmail. Students go in BCC so they don&apos;t see
            each other&apos;s emails, and you&apos;re in To: so you keep a copy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-emails">Student emails</Label>
            <Textarea
              id="invite-emails"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={5}
              placeholder={"student1@nyu.edu, student2@nyu.edu\nor one per line, or paste from a spreadsheet"}
            />
            <div className="text-xs space-y-0.5">
              <p className="text-muted-foreground">
                {valid.length} email{valid.length === 1 ? "" : "s"} ready to invite
              </p>
              {alreadyEnrolled.length > 0 && (
                <p className="text-muted-foreground">
                  Skipping {alreadyEnrolled.length} already enrolled: {alreadyEnrolled.join(", ")}
                </p>
              )}
              {invalid.length > 0 && <p className="text-destructive">Not valid emails: {invalid.join(", ")}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Join link</Label>
            <div className="flex gap-2">
              <Input value={joinLink || "Loading..."} readOnly className="flex-1 text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy(joinLink, "Join link")} disabled={!cls}>
                <Copy className="h-4 w-4" />
                <span className="sr-only">Copy join link</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Class code: <span className="font-mono">{cls?.joinToken ?? "…"}</span>
            </p>
          </div>

          {tooLong && (
            <p className="text-xs text-amber-700">
              That&apos;s a long list for one compose link. If Gmail doesn&apos;t fill in every address, use
              Copy emails and paste them into BCC.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => copy(valid.join(", "), "Emails")} disabled={!valid.length}>
              Copy emails
            </Button>
            <Button variant="outline" size="sm" onClick={() => copy(`${subject}\n\n${body}`, "Message")} disabled={!cls}>
              Copy message
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button asChild className="gap-2">
            <a
              href={cls && valid.length ? gmailUrl : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!cls || !valid.length}
              className={!cls || !valid.length ? "pointer-events-none opacity-50" : ""}
            >
              <Mail className="h-4 w-4" />
              Open in Gmail
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

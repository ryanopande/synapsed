import { Suspense } from "react"
import ChatSection from "@/components/Lesson/AiLesson/ChatSection"

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center">Loading...</div>}>
      <ChatSection />
    </Suspense>
  )
}
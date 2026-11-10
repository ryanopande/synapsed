// app/teacher/classes/page.tsx
import {auth} from "@/lib/auth"
import ClassesPage from "./ClassesClientPage";

export default async function Page() {
  const session = await auth() ;
  const professorId = session?.user?.id;

  if (!professorId) {
    return <div className="p-8 text-red-500">Unauthorized – please sign in.</div>;
  }

  return <ClassesPage professorId={professorId} />;
}
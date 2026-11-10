import React from "react"
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface CourseCardProps {
  title: string
  professor: string
  progress: number
  link: string
}

const CourseCard: React.FC<CourseCardProps> = ({ title, professor, progress, link }) => {
  return (
    <Card className="transition-all hover:shadow-lg border-0 overflow-hidden">
      <div className="bg-gradient-to-br from-emerald-50 via-white to-emerald-100">
        <CardHeader className="pb-2 px-5 pt-5">
          <CardTitle className="text-lg font-semibold text-slate-900">{title}</CardTitle>
          <p className="text-sm text-slate-600">Prof. {professor}</p>
          <div className="mt-2 mb-1 text-xs text-slate-500">
            {progress}% completed
          </div>
        </CardHeader>
        <CardFooter className="px-5 pb-5">
          <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
            <a href={link}>Continue</a>
          </Button>
        </CardFooter>
      </div>
    </Card>
  )
}

export default CourseCard

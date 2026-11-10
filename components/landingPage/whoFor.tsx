import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building, User } from "lucide-react"

export function WhoItsFor() {
  return (
    <section className="w-full py-20 bg-white">
      <div className="container px-4 md:px-6">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-center mb-12">Who It&apos;s For</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="pb-2">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                <Building className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle className="text-xl font-bold">Schools & Universities</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Deploy SynapsEd across classrooms and departments.</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gray-50">
            <CardHeader className="pb-2">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                <User className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle className="text-xl font-bold">Individual Learners (Coming Soon)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Build your own custom pathways.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

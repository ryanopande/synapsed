import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Route, LineChart, FileUp, MessageCircle, Network, Trophy, Link } from "lucide-react"

export function KeyFeatures() {
  const features = [
    {
      icon: Route,
      title: "Personalized AI Pathways",
      description: "Learning journeys that adapt in real time.",
    },
    {
      icon: LineChart,
      title: "Progress Tracking",
      description: "Insightful dashboards for monitoring.",
    },
    {
      icon: FileUp,
      title: "Easy Content Uploads",
      description: "Drag-and-drop PDFs, slides & docs.",
    },
    {
      icon: MessageCircle,
      title: "AI Q&A Chat",
      description: "Instant support & clarification.",
    },
    {
      icon: Network,
      title: "Concept Mapping",
      description: "Visualize and connect ideas.",
    },
    {
      icon: Trophy,
      title: "Gamified Learning",
      description: "Streaks & rewards to boost engagement.",
    },
    {
      icon: Link,
      title: "LMS Integration",
      description: "Works seamlessly with Brightspace, Canvas, etc.",
    },
  ]

  return (
    <section className="w-full py-20 bg-gray-50">
      <div className="container px-4 md:px-6">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-center mb-12">Key Features</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="h-5 w-5 text-purple-600" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

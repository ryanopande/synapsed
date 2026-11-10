import { Brain, BookOpen, AlertTriangle, MessageSquare, Network } from "lucide-react"

export function ResearchDriven() {
  const icons = [
    {
      icon: BookOpen,
      label: "Prior Knowledge Checks",
    },
    {
      icon: Network,
      label: "Adaptive Pathway Adjustments",
    },
    {
      icon: AlertTriangle,
      label: "Misconception Detection",
    },
    {
      icon: MessageSquare,
      label: "Reasoning-Based Feedback",
    },
    {
      icon: Brain,
      label: "Concept Maps & Thematic Clustering",
    },
  ]

  return (
    <section className="w-full py-20 bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-white opacity-70"></div>
      <div className="container px-4 md:px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tighter mb-6">Built on Proven Learning Principles</h2>
          <p className="text-lg text-muted-foreground">
            SynapsEd is built on extensive research in educational psychology—from memory retention to motivation—and
            embeds these insights into every feature.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-8">
          {icons.map((item, index) => (
            <div key={index} className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                <item.icon className="h-8 w-8 text-purple-600" />
              </div>
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

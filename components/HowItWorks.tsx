import { Upload, FocusIcon as UserFocus, Brain, ClipboardEdit, LineChart } from 'lucide-react'

export default function HowItWorks() {
  const steps = [
    { title: "Teachers Upload Course Materials", description: "Easily upload books, videos, syllabi, and other resources.", icon: Upload },
    { title: "Students Share Their Focus", description: "Input existing knowledge and highlight areas of focus.", icon: UserFocus },
    { title: "AI-Generated Learning Pathways", description: "Advanced AI creates personalized learning pathways.", icon: Brain },
    { title: "Teacher Review and Customization", description: "Teachers review and adjust generated pathways.", icon: ClipboardEdit },
    { title: "Students Progress with Confidence", description: "Access personalized pathways and track progress.", icon: LineChart },
  ]

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How It Works</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {steps.map((step, index) => {
          const IconComponent = step.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow-md p-6 flex flex-col items-center text-center">
              <div className="bg-blue-100 rounded-full p-3 mb-4">
                <IconComponent className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-gray-600">{step.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  )
}


import { Button } from "@/components/ui/button"

export function FinalCTA() {
  return (
    <section className="w-full py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="container px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tighter mb-6">
            Let&apos;s connect, and shape the future of learning together.
          </h2>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Button size="lg" className="bg-purple-600 hover:bg-purple-700">
              <a href="mailto:contact@synapsed.edu">Contact Us</a>
            </Button>
            <Button size="lg" variant="outline">
              View Investor Deck
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

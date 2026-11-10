export function ProductSnapshot() {
    return (
      <section className="w-full py-20 bg-white">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tighter mb-6">What is SynapsEd?</h2>
              <p className="text-muted-foreground leading-relaxed">
                SynapsEd is an AI-powered platform that builds unique learning journeys for every student. It adapts to
                each learner&apos;s prior knowledge, pace, and progress, offering a personalized experience that evolves over
                time. Students receive real-time support and motivation, while educators use streamlined dashboards to
                track progress, adjust content, and focus on what matters most: teaching.
              </p>
            </div>
            <div className="relative h-[400px] w-full rounded-lg overflow-hidden shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center">
                <div className="relative w-full max-w-md">
                  <div className="absolute -left-10 top-1/2 -translate-y-1/2">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-r from-purple-300 to-purple-400 shadow-lg flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-white"
                      >
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow-lg p-4 ml-16 mr-4">
                    <div className="h-6 w-full bg-purple-100 rounded mb-3"></div>
                    <div className="h-4 w-3/4 bg-purple-50 rounded mb-2"></div>
                    <div className="h-4 w-5/6 bg-purple-50 rounded mb-2"></div>
                    <div className="h-4 w-2/3 bg-purple-50 rounded mb-4"></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-20 bg-purple-100 rounded"></div>
                      <div className="h-20 bg-purple-100 rounded"></div>
                      <div className="h-20 bg-purple-100 rounded"></div>
                      <div className="h-20 bg-purple-100 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }
  
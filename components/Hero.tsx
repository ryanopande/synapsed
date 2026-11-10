import WaitlistSignup from './WaitlistSignup'

export default function Hero() {
  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8">
      <nav className="flex justify-between items-center mb-8 pb-10">
        <div className="text-2xl font-bold text-gray-900">SynapsED</div>
      </nav>
      <div className="text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
          SynapsED: Personalized Learning, Tailored for Success
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Bridge the gap between educators and students with customized learning experiences.
        </p>
        <WaitlistSignup />
      </div>
    </section>
  )
}


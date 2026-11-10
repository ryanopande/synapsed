import WaitlistSignup from './WaitlistSignup'

export default function Footer() {
  return (
    <footer className="bg-gray-100 py-20 px-4 sm:px-6 lg:px-8 text-center">
      <h2 className="text-3xl font-bold text-gray-900 mb-4">Join the Learning Revolution</h2>
      <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
        Sign up for early access and be part of the future of personalized education.
      </p>
      <WaitlistSignup />
      <p className="mt-8 text-gray-500">© 2025 SynapsED. All rights reserved.</p>
    </footer>
  )
}


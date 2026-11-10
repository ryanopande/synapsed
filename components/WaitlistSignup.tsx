'use client'

import { useState } from 'react'
import { Check } from 'lucide-react';


export default function WaitlistSignup() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loader, setLoader] = useState(false)
  


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoader(true)
    // TODO: Implement waitlist signup logic
    console.log('Signup submitted:', email)

    const response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      throw new Error('Failed to sign up for waitlist')
    } else {
      setEmail('');
      setLoader(false)
      setSent(true);
    }
    
  }

  return (
    <div>
      {!sent ? (
        <form onSubmit={handleSubmit} className="max-w-md mx-auto">
          <div className="flex items-center border-b border-gray-300 py-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="appearance-none bg-transparent border-none w-full text-gray-700 mr-3 py-1 px-2 leading-tight focus:outline-none"
              required
            />
            <button
              type="submit"
              className={`flex-shrink-0 ${loader ? 'bg-gray-500' : 'bg-blue-500 hover:bg-blue-700'} border-blue-500 hover:border-blue-700 text-sm border-4 text-white py-1 px-2 rounded`}
            >
              {loader ? 'Sending...' : 'Join Waitlist'}
            </button>
          </div>
        </form>
      ) : (
        <div className="text-center flex flex-col items-center pt-4">
          <Check className='text-green-500' width={40} height={40}/>
          <p className='text-lg'>Thanks for joining the waitlist, we will be in touch with you soon!</p>
        </div>
      )}
    </div>
  )
}




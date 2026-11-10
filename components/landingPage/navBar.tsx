"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    const controlNavbar = () => {
      if (typeof window !== "undefined") {
        const currentScrollY = window.scrollY

        if (currentScrollY > lastScrollY && currentScrollY > 100) {
          // Scrolling down - hide immediately
          setIsVisible(false)
        } else {
          // Scrolling up - show immediately
          setIsVisible(true)
        }
        setLastScrollY(currentScrollY)
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("scroll", controlNavbar)
      return () => {
        window.removeEventListener("scroll", controlNavbar)
      }
    }
  }, [lastScrollY])

  return (
    <>
      {/* Desktop Header */}
      <nav
        className={`hidden md:block fixed top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
          isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
      >
        <div className="bg-white/20 dark:bg-slate-900/20 backdrop-blur-2xl border border-white/30 dark:border-slate-700/30 rounded-full px-6 py-3 shadow-2xl shadow-slate-200/10 dark:shadow-slate-800/20">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Image
              src="/logo.png"
              alt="SynapsEd Logo"
              width={40} // Adjusted width for better visibility
              height={40} // Adjusted height for better visibility
              className="h-10 w-10" // Tailwind classes for size
            />

            {/* Navigation Links */}
            <div className="flex items-center space-x-6 mx-8">
              <Link
                href="/"
                className="text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm font-medium"
              >
                Home
              </Link>
              <a
                href="/demo"
                className="text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm font-medium"
              >
                Demo
              </a>
              <a
                href="/interest"
                className="text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm font-medium"
              >
                Interest
              </a>
              <a
                href="mailto:m.hassan@nyu.edu?subject=SynapsEd%20Inquiry&body=Hi,%20I'm%20interested%20in%20learning%20more%20about%20SynapsEd."
                className="text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm font-medium"
              >
                Contact Us
              </a>
            </div>

            {/* Join Waitlist Button */}
            <div className="flex items-center">
              <a href="/sign-in">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-full px-4"
                >
                  Sign In
                </Button>
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Header */}
      <nav className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => setIsOpen(!isOpen)} className="text-slate-700 dark:text-slate-200">
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          {/* Centered Logo for Mobile */}
          <Image
            src="/logo.png"
            alt="SynapsEd Logo"
            width={40} // Adjusted width for better visibility
            height={40} // Adjusted height for better visibility
            className="h-10 w-10" // Tailwind classes for size
          />
        </div>

        {isOpen && (
          <div className="bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200/50 dark:border-slate-800/50 px-4 py-4 space-y-4">
            <Link
              href="/"
              className="block text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 text-base font-medium py-2"
              onClick={() => setIsOpen(false)}
            >
              Home
            </Link>
            <a
              href="/demo"
              className="block text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 text-base font-medium py-2"
              onClick={() => setIsOpen(false)}
            >
              Demo
            </a>
            <a
              href="/interest"
              className="block text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 text-base font-medium py-2"
              onClick={() => setIsOpen(false)}
            >
              Interest
            </a>
            <a
              href="mailto:m.hassan@nyu.edu?subject=SynapsEd%20Inquiry&body=Hi,%20I'm%20interested%20in%20learning%20more%20about%20SynapsEd."
              className="block text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 text-base font-medium py-2"
              onClick={() => setIsOpen(false)}
            >
              Contact Us
            </a>
            <a href="/waitlist-page">
              <Button
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-lg mt-4"
                onClick={() => setIsOpen(false)}
              >
                Join Waitlist
              </Button>
            </a>
          </div>
        )}
      </nav>
    </>
  )
}

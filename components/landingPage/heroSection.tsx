"use client"

import { Button } from "@/components/ui/button"

import { motion } from "framer-motion"
import { Sparkles, ArrowRight } from "lucide-react"
import { SynapseBackground } from "@/components/landingPage/background"
export function HeroSection() {

  return (
    <section className="relative min-h-screen flex items-start justify-center overflow-hidden pt-20 mt-20 md:pt-24">
      {/* Canvas background - keeping as is */}
      
      <SynapseBackground />
      {/* Static background elements */}
      <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 2 }}>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-400/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-teal-500/10 dark:bg-teal-400/10 rounded-full blur-3xl animate-pulse [animation-delay:1000ms]" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-emerald-600/10 dark:bg-emerald-500/10 rounded-full blur-3xl animate-pulse [animation-delay:2000ms]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ zIndex: 3 }}>
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center px-4 py-2 rounded-full bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm mb-6 md:mb-8 backdrop-blur-sm border border-emerald-200/50 dark:border-emerald-800/50"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Building the future of education
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative z-10 space-y-4 md:space-y-5 lg:space-y-6 mb-6 md:mb-7 lg:mb-9 max-w-md md:max-w-[500px] lg:max-w-[588px] mt-4 md:mt-6 lg:mt-8 px-4 mx-auto"
          >
            <h1 className="text-foreground text-3xl md:text-4xl lg:text-6xl font-semibold leading-tight">
              Enabling Targeted Teaching at scale{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                with AI
              </span>
            </h1>
            <p className="text-muted-foreground text-base md:text-base lg:text-lg leading-relaxed max-w-lg mx-auto">
              SynapsEd delivers personalized learning pathways that adapt to each student&apos;s unique needs, learning style, and progress.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex justify-center gap-4 mb-12 md:mb-16"
          >
            <a href="/student/dashboard">
              <Button className="relative z-10 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-8 py-3 rounded-full font-medium text-base shadow-lg ring-1 ring-white/10 transition-all duration-300 group">
                Student
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </a>
            <a href="/teacher/dashboard">
              <Button variant="outline" className="relative z-10 border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 px-8 py-3 rounded-full font-medium text-base transition-all duration-300">
                Educator
                <ArrowRight className="ml-2 h-4 w-4 transition-transform" />
              </Button>
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

import { Navbar } from "@/components/landing/Navbar"
import { HeroSection } from "@/components/landing/HeroSection"
// import { ProductSnapshot } from "@/components/landing/ProductSnapshot"
// import { HowItWorks } from "@/components/landing/HowItWorks"
// import { ResearchDriven } from "@/components/landing/ResearchDriven"
// import { KeyFeatures } from "@/components/landing/KeyFeatures"
// import { WhoItsFor } from "@/components/landing/WhoItsFor"
// import { FinalCTA } from "@/components/landing/FinalCTA"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center">
      <Navbar />
      <HeroSection />
      {/* <ProductSnapshot />
      <HowItWorks />
      <ResearchDriven />
      <KeyFeatures />
      <WhoItsFor />
      <FinalCTA /> */}
    </main>
  )
}

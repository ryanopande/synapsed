import { Navbar } from "@/components/landingPage/navBar"
import { HeroSection } from "@/components/landingPage/heroSection"
// import { ProductSnapshot } from "@/components/landingPage/productSnapShot"
// import { HowItWorks } from "@/components/landingPage/howItWorks"
// import { ResearchDriven } from "@/components/landingPage/researchDriven"
// import { KeyFeatures } from "@/components/landingPage/keyFeatures"
// import { WhoItsFor } from "@/components/landingPage/whoFor"
// import { FinalCTA } from "@/components/landingPage/finalCTA"

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

'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { signOut } from "next-auth/react"

export default function ChooseRolePage() {
  const [role, setRole] = useState("STUDENT")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch("/api/set-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    if (res.ok) {
      await signOut({ callbackUrl: "/sign-in" })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Choose your role</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <RadioGroup defaultValue={role} onValueChange={setRole} className="space-y-3">
              {["STUDENT", "PROFESSOR", "ADMIN"].map((option) => (
                <div key={option} className="flex items-center space-x-3">
                  <RadioGroupItem value={option} id={option.toLowerCase()} />
                  <Label htmlFor={option.toLowerCase()} className="text-base font-medium capitalize">
                    {option.toLowerCase()}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <Button type="submit" className="w-full">Continue</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
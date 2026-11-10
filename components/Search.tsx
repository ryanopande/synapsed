'use client'

import { useState } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// Mock data for search results
const mockData = [
  "Apple", "Banana", "Cherry", "Date", "Elderberry",
  "Fig", "Grape", "Honeydew", "Kiwi", "Lemon"
]

export default function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<string[]>([])

  const handleSearch = () => {
    const filteredResults = mockData.filter(item =>
      item.toLowerCase().includes(query.toLowerCase())
    )
    setResults(filteredResults)
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Input
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-grow"
        />
        <Button onClick={handleSearch}>Search</Button>
      </div>
      <ul className="list-disc pl-5">
        {results.map((item, index) => (
          <li key={index} className="mb-1">{item}</li>
        ))}
      </ul>
    </div>
  )
}

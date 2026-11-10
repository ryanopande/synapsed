'use client';
import { useState } from 'react';

interface SearchResult {
  metadata: {
    page: number;
    text?: string;
    chunk?: string;
  };
}

export default function QueryTestPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  const search = async () => {
    const res = await fetch('/api/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();
    setResults(data.matches);
  };

 

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Semantic Search</h1>
      <input
        type="text"
        placeholder="Ask a question..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="border p-2 w-full my-2"
      />
      <button onClick={search} className="bg-indigo-600 text-white px-4 py-2 rounded">Search</button>

      <ul className="mt-6 space-y-4 text-sm">
        {results.map((res: SearchResult, i) => (
          <li key={i} className="p-2 border rounded">
            <strong>Page {res.metadata.page}</strong>
            <p>{res.metadata.text || res.metadata.chunk || 'No text available'}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

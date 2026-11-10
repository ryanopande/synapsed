'use client';
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function JoinClassPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  const handleJoin = async () => {
    if (!token.trim()) return alert("Please enter a valid token");
    //console.log("user id: ", session?.user?.name)
    if (!session?.user?.id) return alert("You must be signed in");

    try {
      setLoading(true);
      const res = await fetch("/api/student/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinToken: token }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to join class");
        return;
      }

      alert(data.message || "Successfully joined class!");

      // Optional: Redirect to student dashboard or class page
      router.push("/student/dashboard");
    } catch (error) {
      console.error("Join failed", error);
      alert("An error occurred while trying to join the class.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-6">
      <div className="glass rounded-2xl shadow-lg w-full max-w-md p-6">
        <h1 className="text-2xl font-bold mb-4 text-center text-slate-900">Join a Class</h1>
        <Input
          placeholder="Enter class token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="mb-4"
        />
        <Button onClick={handleJoin} className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
          {loading ? "Joining..." : "Join Class"}
        </Button>
      </div>
    </div>
  );
}

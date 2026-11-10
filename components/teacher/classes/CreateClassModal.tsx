"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";


type Props = {
  professorId: string;
  isOpen: boolean;
  onClose: () => void;
  refreshClasses: () => void;
};

export default function CreateClassModal({
  isOpen,
  onClose,
  refreshClasses,
  professorId,
}: Props) {
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdToken, setCreatedToken] = useState("");

  if (!isOpen) return null;

  const handleCreateClass = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/professor/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: className,
          description: "",
          professorId,
        }),
      });

      const data = await res.json();
      setCreatedToken(data.joinToken);
      refreshClasses();
    } catch (err) {
      console.error(err);
      
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(createdToken);
    
  };

  return (
    <>
      {!createdToken ? (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-40">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-lg font-bold mb-4">Create New Class</h2>
            <input
              type="text"
              placeholder="Class Name"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full border p-2 rounded-lg mb-4"
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleCreateClass} disabled={loading}>
                {loading ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96 text-center">
            <h2 className="text-xl font-semibold mb-4">Class Created!</h2>
            <p className="text-gray-600 mb-2">Here is your class token:</p>
            <div className="bg-gray-100 p-2 rounded-lg flex justify-between items-center mb-4 text-left w-full">
              <span className="text-sm break-all pr-2">{createdToken}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyToken}
                className="text-blue-600 hover:underline"
              >
                Copy
              </Button>
            </div>
            <Button
              onClick={() => {
                setCreatedToken("");
                setClassName("");
                onClose();
              }}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
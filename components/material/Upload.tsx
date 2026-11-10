"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function UploadPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append("classId", "67f278948d12bf29bcfd8f21"); // 👉 Change to real classId

    selectedFiles.forEach(file => {
      formData.append("files", file);
    });

    try {
      const res = await fetch("/api/classMaterial/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        toast("Upload complete", {
          description: `${data.materials.length} files uploaded.`
        });
        setSelectedFiles([]);
      } else {
        toast("Upload failed", {
          description: data.error
        });
      }
    } catch (error) {
      toast("Upload error", {
        description: error instanceof Error ? error.message : "Something went wrong."
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <h2 className="text-2xl font-bold mb-4">Dummy Upload Test Page</h2>
      <input type="file" multiple onChange={handleFileChange} className="mb-4" />
      <div className="space-x-2">
        <Button onClick={handleUpload} disabled={isUploading}>
          {isUploading ? "Uploading..." : `Upload ${selectedFiles.length} Files`}
        </Button>
        <Button variant="outline" onClick={() => setSelectedFiles([])}>
          Clear
        </Button>
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-4">
          <h3 className="font-medium mb-2">Selected Files:</h3>
          <ul className="list-disc pl-6 text-sm">
            {selectedFiles.map(file => (
              <li key={file.name}>{file.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

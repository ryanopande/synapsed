"use client";

import { UploadSection } from "./Upload/page";
import { ContentView } from "./contentView/page";
import { mutate } from "swr";

export default function ContentManagement({ classId }: { classId: string }) {
  const handleUploadComplete = () => {
    // Invalidate SWR cache to trigger refetch
    mutate(`/api/class/${classId}/materials`);
  };

  return (
    <div className="space-y-6">
      <UploadSection classId={classId} onUploadComplete={handleUploadComplete} />
      <ContentView classId={classId} />
    </div>
  );
}

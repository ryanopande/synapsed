export type PathwayData = {
    id: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    status: string;
    professorNotes?: string;
    approvedAt?: string;
    rejectedAt?: string;
    createdAt: string;
    updatedAt: string;
    nodes: {
      id: string;
      nodeId: string;
      title: string;
      description: string;
      type: string;
      difficulty: string;
      duration: string;
      dependsOn: string[];
    }[];
    nodeCount: number;
  };
  
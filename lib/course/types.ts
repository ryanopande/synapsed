export type CourseTopic = {
  id: string;
  title: string;
  summary: string;
  keyConcepts: string[];
  prerequisites: string[]; // ids of other topics in the same map
  order: number;
};

export type TopicMastery = {
  level: "weak" | "developing" | "strong" | "unassessed";
  score: number | null; // 0..1, null when unassessed
  correct: number;
  total: number;
  unsure: number;
};

export type MasteryProfile = {
  topics: Record<string, TopicMastery>;
  preferences: { question: string; answer: string }[];
};

// Pure lesson-lock rule, safe to import from client components (no database access).

export interface LockableNode {
  nodeId: string;
  title: string;
  dependsOn: string[];
  aiLessonComplete: boolean;
}

/**
 * Lessons the given lesson is still waiting on: prerequisites (dependsOn) in the
 * same pathway that aren't complete. An empty list means the lesson is unlocked.
 * Shared by the server and the pathway map so both lock the same lessons.
 */
export function incompletePrerequisites<T extends LockableNode>(node: T, pathwayNodes: T[]): T[] {
  const byKey = new Map(pathwayNodes.map((n) => [n.nodeId, n]));
  return (node.dependsOn ?? [])
    .map((key) => byKey.get(key))
    .filter((dep): dep is T => !!dep && !dep.aiLessonComplete);
}

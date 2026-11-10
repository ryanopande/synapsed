import { 
    Node, 
    Edge, 
    NodeChange, 
    EdgeChange, 
    OnNodesChange, 
    OnEdgesChange, 
    applyNodeChanges, 
    applyEdgeChanges,
    Connection
  } from '@xyflow/react';
  import { nanoid } from 'nanoid';
  import { create } from 'zustand';
  
  // Define node data structure
  export type PathwayNodeData = {
      title: string;
      description: string;
      type: 'topic' | 'subtopic' | 'resource' | 'assessment';
      difficulty?: 'beginner' | 'intermediate' | 'advanced';
      duration?: string;
      resourceUrl?: string;
      markdownContent?: string; // Added new optional field for rich content
      dbId?: string; // Database ID for this node
  };

  // Define pathway node type
  export type PathwayNode = Node<PathwayNodeData>;
  
  // Define our store state
  export type PathwayState = {
    nodes: PathwayNode[];
    edges: Edge[];
    isLoading: boolean;
    error: string | null;
    prompt: string;
    
    // Actions
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: (connection: Connection) => void;
    addNode: (node: Partial<PathwayNode>) => void;
    updateNodeData: (nodeId: string, data: Partial<PathwayNodeData>) => void;
    removeNode: (nodeId: string) => void;
    fetchPathway: (prompt: string, studentId: string, classId: string) => Promise<void>;
    setPrompt: (prompt: string) => void;
  };

  // laying out the nodes 

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function layoutNodes(nodes: any[]): { nodes: PathwayNode[]; edges: Edge[] } {
    // Using type assertion to avoid 'any' linter errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeMap = new Map(nodes.map((n: any) => [n.nodeId, n]));
    const levels: Record<string, number> = {};
  
    // Assign level using dependencies
    function getLevel(nodeId: string): number {
      if (!nodeMap.has(nodeId)) return 0;
      if (levels[nodeId] !== undefined) return levels[nodeId];
  
      const node = nodeMap.get(nodeId);
      if (!node.dependsOn || node.dependsOn.length === 0) {
        levels[nodeId] = 0;
      } else {
        levels[nodeId] = Math.max(...node.dependsOn.map(getLevel)) + 1;
      }
      return levels[nodeId];
    }
  
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodes.forEach((n: any) => getLevel(n.nodeId));
  
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const levelGroups: Record<number, any[]> = {};
    nodes.forEach(n => {
      const lvl = levels[n.nodeId] ?? 0;
      if (!levelGroups[lvl]) levelGroups[lvl] = [];
      levelGroups[lvl].push(n);
    });
  
    const finalNodes: PathwayNode[] = [];
    const spacingX = 300;
    const spacingY = 200;
  
    Object.entries(levelGroups).forEach(([lvlStr, group]) => {

      group.forEach((node, colIdx) => {
        finalNodes.push({
          id: node.nodeId,
          type: 'pathway',
          position: {
            x: colIdx * spacingX,
            y: parseInt(lvlStr) * spacingY,
          },
          data: {
            title: node.title,
            description: node.description,
            type: node.type,
            difficulty: node.difficulty,
            duration: node.duration,
            markdownContent: node.markdownContent || 'Click to load content...',
            dbId: node.id,
          }
        });
      });
    });
  
    const edges: Edge[] = nodes.flatMap(node =>
      (node.dependsOn || []).map((depId: string) => ({
        id: `e${depId}-${node.nodeId}`,
        source: depId,
        target: node.nodeId,
        type: 'pathway'
      }))
    );

    
  
    return { nodes: finalNodes, edges };
  }
  
  
  // Create the store
  const usePathwayStore = create<PathwayState>((set, get) => ({
    nodes: [],
    edges: [],
    isLoading: false,
    error: null,
    prompt: "Learning Digital Marketing and how AI can help reach clients. Different tracks.",
    
    // Handle node changes (position, selection, etc.)
    onNodesChange: (changes: NodeChange[]) => {
      set({
        nodes: applyNodeChanges(changes, get().nodes) as PathwayNode[],
      });
    },
    
    // Handle edge changes
    onEdgesChange: (changes: EdgeChange[]) => {
      set({
        edges: applyEdgeChanges(changes, get().edges),
      });
    },
    
    // Handle new connections between nodes
    onConnect: (connection: Connection) => {
      set({
        edges: [
          ...get().edges,
          {
            id: nanoid(),
            source: connection.source!,
            target: connection.target!,
            type: 'pathway'
          }
        ]
      });
    },
    
    // Add a new node
    addNode: (nodePartial: Partial<PathwayNode>) => {
      const newNode: PathwayNode = {
        id: nanoid(),
        type: 'pathway',
        position: { x: 0, y: 0 },
        data: {
          title: 'New Node',
          description: 'Add description here',
          type: 'topic'
        },
        ...nodePartial
      };
      
      set({
        nodes: [...get().nodes, newNode]
      });
      
      return newNode.id;
    },
    
    // Update node data
    updateNodeData: (nodeId: string, data: Partial<PathwayNodeData>) => {
      set({
        nodes: get().nodes.map(node => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, ...data }
            };
          }
          return node;
        })
      });
    },
    
    // Remove a node and its connected edges
    removeNode: (nodeId: string) => {
      set({
        nodes: get().nodes.filter(node => node.id !== nodeId),
        edges: get().edges.filter(edge => 
          edge.source !== nodeId && edge.target !== nodeId
        )
      });
    },
    
    // Fetch pathway data
    fetchPathway: async (prompt: string, studentId: string, classId: string) => {
      set({ isLoading: true, error: null });
      
      try {
        // In a real app, this would call your API
        // For now, we'll simulate a response with dummy data
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create dummy data based on prompt
        // NEW: Dynamic fetch from your mock API
        const res = await fetch(`/api/pathway/get?studentId=${studentId}&classId=${classId}`);
        const skeleton = await res.json();
        //console.log("Skeleton:", skeleton);

        

        const nodesArray = Array.isArray(skeleton) ? skeleton : skeleton.nodes ?? [];
        const { nodes, edges } = layoutNodes(nodesArray); // This generates edges from dependsOn
        set({ nodes, edges, isLoading: false, prompt });
        

      } catch (error) {
        console.error(error);
        set({ 
          error: error instanceof Error ? error.message : 'An unknown error occurred',
          isLoading: false 
        });
      }
    },
    
    // Update prompt
    setPrompt: (prompt: string) => {
      set({ prompt });
    }
  }));
  
 
  export default usePathwayStore;
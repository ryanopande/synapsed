'use client';
import {useShallow} from 'zustand/shallow';
import React, { useEffect, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  Panel,
  ReactFlowProvider,
  BackgroundVariant,
  Node
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import useSWR from 'swr';
import usePathwayStore, { PathwayState, PathwayNodeData } from './store';
import PathwayNode from './PathwayNode';
import PathwayEdge from './PathwayEdge';
import './Pathway.css';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';

// No syntax highlighter needed here after moving content to a dedicated page

// Define node and edge types
const nodeTypes = {
  pathway: PathwayNode,
};

const edgeTypes = {
  pathway: PathwayEdge,
};



// Create selector for store values
const selector = (state: PathwayState) => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  onConnect: state.onConnect,
  fetchPathway: state.fetchPathway,
  isLoading: state.isLoading,
  error: state.error,
  prompt: state.prompt,
  setPrompt: state.setPrompt,
});

function PathwayFlow() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    fetchPathway,
    prompt,
    isLoading,
  } = usePathwayStore(useShallow(selector));
  
  const router = useRouter();
  const { data: session } = useSession();
  const { classId } = useParams();
  const studentId = session?.user?.id;
  const classIdStr = Array.isArray(classId) ? classId[0] : classId;
  const [isNavigating, setIsNavigating] = useState(false);
  // Show skeleton only when we do not yet have nodes AND we are loading
  const showSkeleton = isLoading && nodes.length === 0;

  // Fetcher for pathway existence check
  const pathwayExistsFetcher = async (url: string) => {
    const res = await fetch(url);
    const data = await res.json();
    return data.exists;
  };

  // Use SWR for pathway existence check (cached and fast)
  const pathwayExistsKey = studentId && classIdStr 
    ? `/api/pathway/exists/${classIdStr}/${studentId}`
    : null;
  
  const { data: pathwayExists } = useSWR(
    pathwayExistsKey,
    pathwayExistsFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
    }
  );

  // Fetch pathway on initial load
  useEffect(() => {
    if (studentId && classIdStr) {
      fetchPathway(prompt, studentId, classIdStr);
    }
  }, [prompt, studentId, classIdStr, fetchPathway]);
  
  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    event.stopPropagation();
    const nodeTitle = (node.data as PathwayNodeData).title;
    const dbId = (node.data as PathwayNodeData).dbId;
    if (classIdStr) {
      setIsNavigating(true);
      const idToUse = dbId ?? node.id;
      console.log('idToUse', idToUse);
      router.push(`/class/${classIdStr}/lesson/${idToUse}?nodeTitle=${encodeURIComponent(nodeTitle)}`);
    }
  };
  
  return (
    <div className="pathway-container">
      {showSkeleton && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-[min(100%,900px)] px-6 animate-pulse">
              <div className="mx-auto h-6 w-64 bg-slate-200 rounded mb-6" />
              <div className="relative pl-8">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200" />
                <div className="space-y-6">
                  <div>
                    <div className="h-4 w-56 bg-slate-200 rounded mb-2" />
                    <div className="ml-6 h-3 w-40 bg-slate-100 rounded" />
                  </div>
                  <div>
                    <div className="h-4 w-40 bg-slate-200 rounded mb-2" />
                    <div className="ml-6 grid grid-cols-2 gap-3">
                      <div className="h-3 w-32 bg-slate-100 rounded" />
                      <div className="h-3 w-28 bg-slate-100 rounded" />
                    </div>
                  </div>
                  <div>
                    <div className="h-4 w-64 bg-slate-200 rounded mb-2" />
                    <div className="ml-6 grid grid-cols-3 gap-3">
                      <div className="h-3 w-28 bg-slate-100 rounded" />
                      <div className="h-3 w-32 bg-slate-100 rounded" />
                      <div className="h-3 w-24 bg-slate-100 rounded" />
                    </div>
                  </div>
                  <div>
                    <div className="h-4 w-52 bg-slate-200 rounded mb-2" />
                    <div className="ml-6 grid grid-cols-2 gap-3">
                      <div className="h-3 w-36 bg-slate-100 rounded" />
                      <div className="h-3 w-28 bg-slate-100 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Show message if pathway is not available */}
      {(!isLoading && pathwayExists === false && pathwayExists !== undefined && (
        <div className="flex flex-col items-center justify-center h-64 text-center text-gray-500">
          <div className="text-2xl mb-2">🍳 Your pathway is cooking!</div>
          <div>Your professor will approve it soon. Come back later.</div>
        </div>
      ))}
      {pathwayExists && nodes.length > 0 && (
        <div className="pathway-flow">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            attributionPosition="bottom-left"
          >
            <Controls />
            <MiniMap 
              nodeStrokeWidth={3}
              zoomable
              pannable
            />
            <Background 
              variant={'dots' as BackgroundVariant}
              gap={12} 
              size={1} 
              color="#f1f1f1" 
            />
            <Panel position="top-left" className="pathway-info-panel">
              <h3>Learning Pathway</h3>
              <p className="text-sm text-gray-600">
                {nodes.length} topics · {edges.length} connections
              </p>
            </Panel>
          </ReactFlow>
        </div>
      )}

      {/* Navigation spinner overlay */}
      {isNavigating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="w-full max-w-md px-6 animate-pulse">
            <div className="h-6 w-40 bg-slate-200 rounded mb-4 mx-auto" />
            <div className="space-y-3">
              <div className="h-3 w-full bg-slate-100 rounded" />
              <div className="h-3 w-11/12 bg-slate-100 rounded" />
              <div className="h-3 w-10/12 bg-slate-100 rounded" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap with provider to ensure React Flow hooks work
export default function SynapsedFlow() {
  return (
    <ReactFlowProvider>
      <PathwayFlow />
    </ReactFlowProvider>
  );
}

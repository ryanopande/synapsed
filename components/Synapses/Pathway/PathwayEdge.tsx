import React from 'react';
import { EdgeProps, getBezierPath } from '@xyflow/react';

function PathwayEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        style={{
          ...style,
          strokeWidth: 2,
          stroke: '#6366F1', // Indigo color
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {/* Optional: Add animated dots along the path for visual interest */}
      <circle 
        className="animated-dot"
        r="3" 
        fill="#6366F1"
        style={{
          filter: 'drop-shadow(0 0 1px white)',
        }}
      >
        <animateMotion
          dur="6s"
          repeatCount="indefinite"
          path={edgePath}
        />
      </circle>
      <circle 
        className="animated-dot"
        r="3" 
        fill="#6366F1"
        style={{
          filter: 'drop-shadow(0 0 1px white)',
          opacity: 0.7,
        }}
      >
        <animateMotion
          dur="6s"
          begin="2s"
          repeatCount="indefinite"
          path={edgePath}
        />
      </circle>
    </>
  );
}

export default PathwayEdge;
"use client";

import { useRef } from "react";
import { Excalidraw, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export interface DiagramData {
  elements?: unknown[];
  appState?: Record<string, unknown>;
}

interface Props {
  data: DiagramData;
}

export default function ExcalidrawCanvas({ data }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const converted = convertToExcalidrawElements((data.elements ?? []) as any);

  return (
    <Excalidraw
      excalidrawAPI={(api) => {
        apiRef.current = api;
      }}
      initialData={{
        elements: converted,
        appState: {
          viewBackgroundColor: "#ffffff",
          ...(data.appState ?? {}),
        },
      }}
      UIOptions={{
        canvasActions: {
          export: false,
          saveAsImage: true,
          loadScene: false,
          saveToActiveFile: false,
        },
      }}
    />
  );
}

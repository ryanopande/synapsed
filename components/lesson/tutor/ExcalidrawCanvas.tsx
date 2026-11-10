"use client";

import { Component, useMemo, type ReactNode } from "react";
import { Excalidraw, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export interface DiagramData {
  elements?: unknown[];
  appState?: Record<string, unknown>;
}

interface Props {
  data: DiagramData;
}

// Load fonts from our own origin (copied by scripts/copy-excalidraw-assets.mjs)
// instead of a public CDN, which can be blocked or offline.
if (typeof window !== "undefined") {
  (window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH =
    "/excalidraw-assets/";
}

// Pseudo-elements the Excalidraw MCP uses for camera/undo control; they are not drawable.
const NON_DRAWABLE = new Set(["cameraUpdate", "delete", "restoreCheckpoint"]);

function toDrawable(raw: unknown[] | undefined) {
  const cleaned = (raw ?? []).filter(
    (el): el is Record<string, unknown> =>
      !!el &&
      typeof el === "object" &&
      typeof (el as { type?: unknown }).type === "string" &&
      !NON_DRAWABLE.has((el as { type: string }).type)
  );
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return convertToExcalidrawElements(cleaned as any);
  } catch (error) {
    console.error("[ExcalidrawCanvas] could not convert diagram elements", error);
    return null;
  }
}

function Fallback({ message }: { message: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center px-4 text-center text-sm text-gray-400">
      {message}
    </div>
  );
}

// Catches anything Excalidraw throws while rendering (including raw DOM Events from
// failed asset loads) so one bad diagram can't crash the whole lesson page.
class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[ExcalidrawCanvas] render failed", error);
  }
  render() {
    return this.state.failed ? (
      <Fallback message="This diagram couldn't be displayed. Try asking for it again." />
    ) : (
      this.props.children
    );
  }
}

export default function ExcalidrawCanvas({ data }: Props) {
  const converted = useMemo(() => toDrawable(data.elements), [data.elements]);

  if (!converted || converted.length === 0) {
    return <Fallback message="This diagram has nothing to display." />;
  }

  return (
    <CanvasBoundary>
      <Excalidraw
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
    </CanvasBoundary>
  );
}

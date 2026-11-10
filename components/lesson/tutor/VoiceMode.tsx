"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DiagramData } from "./ExcalidrawCanvas";

type AgentState = "idle" | "listening" | "thinking" | "speaking";

export interface VoiceTurnPayload {
  userText: string;
  assistantText: string;
  diagramData?: DiagramData | null;
  threadId?: string;
}

interface Props {
  threadId?: string | null;
  classId?: string;
  lessonId?: string;
  userId?: string;
  onClose: () => void;
  onTurn: (payload: VoiceTurnPayload) => void;
}

const STATE_LABEL: Record<AgentState, string> = {
  idle: "Connecting...",
  listening: "Listening",
  thinking: "Thinking...",
  speaking: "Speaking",
};

export default function VoiceMode({
  threadId,
  classId,
  lessonId,
  userId,
  onClose,
  onTurn,
}: Props) {
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "error"
  >("connecting");
  const [errorMsg, setErrorMsg] = useState("");
  const [captions, setCaptions] = useState<string[]>([]);
  const [processingCount, setProcessingCount] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const turnChainRef = useRef<Promise<void>>(Promise.resolve());
  const closedRef = useRef(false);
  const threadIdRef = useRef<string | null>(threadId ?? null);
  const turnCounterRef = useRef(0);

  useEffect(() => {
    threadIdRef.current = threadId ?? threadIdRef.current;
  }, [threadId]);

  const addCaption = useCallback((text: string) => {
    if (!text) return;
    setCaptions((prev) => [...prev.slice(-2), text]);
  }, []);

  const speakAssistantText = useCallback((assistantText: string) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") return;

    dc.send(
      JSON.stringify({
        type: "response.create",
        response: {
          modalities: ["audio"],
          instructions: `Speak naturally to the student. Use this exact teaching response:\n\n${assistantText}`,
        },
      })
    );
  }, []);

  const processVoiceTurn = useCallback(
    async (transcript: string, turnId: string) => {
      const cleanTranscript = transcript.trim();
      if (!cleanTranscript || closedRef.current) return;

      setProcessingCount((n) => n + 1);
      setAgentState("thinking");
      addCaption(`You: ${cleanTranscript}`);

      try {
        const response = await fetch("/api/voice-turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: cleanTranscript,
            turnId,
            threadId: threadIdRef.current,
            classId,
            lessonId,
            userId,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || "Failed voice turn");
        }

        const data = (await response.json()) as {
          userText: string;
          assistantText: string;
          diagramData?: DiagramData | null;
          threadId?: string;
        };

        if (data.threadId) {
          threadIdRef.current = data.threadId;
        }

        onTurn({
          userText: data.userText,
          assistantText: data.assistantText,
          diagramData: data.diagramData ?? null,
          threadId: data.threadId,
        });

        addCaption(`Tutor: ${data.assistantText}`);
        setAgentState("speaking");
        speakAssistantText(data.assistantText);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to process voice turn.";
        setErrorMsg(message);
        setConnectionStatus("error");
      } finally {
        setProcessingCount((n) => Math.max(0, n - 1));
      }
    },
    [addCaption, classId, lessonId, onTurn, speakAssistantText, userId]
  );

  const queueVoiceTurn = useCallback(
    (transcript: string) => {
      const turnId = `turn-${Date.now()}-${turnCounterRef.current++}`;
      turnChainRef.current = turnChainRef.current
        .then(() => processVoiceTurn(transcript, turnId))
        .catch(() => {
          // preserve queue chain
        });
    },
    [processVoiceTurn]
  );

  const sendSessionConfig = useCallback(() => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") return;
    dc.send(
      JSON.stringify({
        type: "session.update",
        session: {
          type: "realtime",
          model: "gpt-realtime-2",
          output_modalities: ["audio"],
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 24000 },
              turn_detection: { type: "semantic_vad" },
              transcription: { model: "gpt-4o-mini-transcribe" },
            },
            output: {
              voice: "marin",
              format: { type: "audio/pcm" },
            },
          },
          instructions:
            "You are the voice channel for Synapsed. Do not teach on your own. You will only read responses generated by the backend tutor.",
        },
      })
    );
  }, []);

  const handleRealtimeEvent = useCallback(
    (raw: string) => {
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(raw);
      } catch {
        return;
      }

      const type = String(event.type ?? "");
      switch (type) {
        case "session.created":
          setConnectionStatus("connected");
          setAgentState("listening");
          sendSessionConfig();
          break;
        case "input_audio_buffer.speech_started":
          // Barge-in behavior: cancel any in-flight audio generation so user can interrupt.
          dcRef.current?.send(JSON.stringify({ type: "response.cancel" }));
          setAgentState("listening");
          break;
        case "input_audio_buffer.speech_stopped":
          setAgentState("thinking");
          break;
        case "response.output_audio.delta":
          setAgentState("speaking");
          break;
        case "response.done":
          if (processingCount === 0) setAgentState("listening");
          break;
        case "conversation.item.done": {
          const item = event.item as
            | { role?: string; content?: Array<{ type?: string; transcript?: string }> }
            | undefined;
          if (!item || item.role !== "user" || !Array.isArray(item.content)) break;
          for (const part of item.content) {
            const transcript = String(part?.transcript ?? "").trim();
            if (part?.type === "input_audio" && transcript) {
              queueVoiceTurn(transcript);
            }
          }
          break;
        }
        default:
          break;
      }
    },
    [processingCount, queueVoiceTurn, sendSessionConfig]
  );

  const connect = useCallback(async () => {
    setConnectionStatus("connecting");
    setAgentState("idle");
    setErrorMsg("");

    try {
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.addEventListener("message", (e) => handleRealtimeEvent(e.data));

      const audioEl = new Audio();
      audioEl.autoplay = true;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      pc.addTrack(ms.getTracks()[0]);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch("/api/session", {
        method: "POST",
        body: offer.sdp || "",
        headers: { "Content-Type": "application/sdp" },
      });
      if (!sdpRes.ok) {
        const errText = await sdpRes.text();
        throw new Error(`Connection failed: ${errText}`);
      }

      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
    } catch (error) {
      setConnectionStatus("error");
      setErrorMsg(error instanceof Error ? error.message : "Connection failed");
    }
  }, [handleRealtimeEvent]);

  useEffect(() => {
    void connect();
    return () => {
      closedRef.current = true;
      pcRef.current?.close();
    };
  }, [connect]);

  function handleClose() {
    closedRef.current = true;
    pcRef.current?.close();
    onClose();
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-6">
      {connectionStatus === "error" ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-gray-500 text-sm max-w-xs">{errorMsg}</p>
          <button
            onClick={connect}
            className="text-sm px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="relative w-28 h-28">
            <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-50" />
            <div className="absolute inset-3 rounded-full bg-emerald-200/70 animate-pulse" />
            <div className="absolute inset-7 rounded-full bg-emerald-500" />
          </div>

          <p
            className="text-sm tracking-wide transition-colors duration-300"
            style={{ color: agentState === "speaking" ? "#22c55e" : "#9ca3af" }}
          >
            {STATE_LABEL[agentState]}
          </p>

          <div className="w-full max-w-xl min-h-[4rem] flex flex-col gap-1.5">
            {captions.slice(-3).map((line, i) => (
              <p
                key={`${line}-${i}`}
                className={`text-sm text-center leading-relaxed transition-opacity duration-300 ${
                  i === captions.slice(-3).length - 1 ? "opacity-100" : "opacity-40"
                } text-gray-700`}
              >
                {line}
              </p>
            ))}
          </div>
        </>
      )}

      <button
        onClick={handleClose}
        className="mt-4 text-sm text-gray-400 hover:text-gray-700 transition-colors border border-gray-200 hover:border-gray-400 px-5 py-2 rounded-lg"
      >
        End conversation
      </button>
    </div>
  );
}

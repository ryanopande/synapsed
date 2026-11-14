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

/** Turn raw getUserMedia / connection failures into something a student can act on. */
function describeVoiceError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone access is blocked. Click the lock or camera icon in your browser's address bar, set Microphone to Allow, then press Retry. On a Mac, also check System Settings → Privacy & Security → Microphone and make sure your browser is switched on.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No microphone was found. Plug in or enable a microphone, then press Retry.";
    case "NotReadableError":
    case "AbortError":
      return "Your microphone is in use by another app or tab. Close it, then press Retry.";
    default:
      return error instanceof Error ? error.message : "Connection failed";
  }
}

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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const turnChainRef = useRef<Promise<void>>(Promise.resolve());
  const closedRef = useRef(false);
  const threadIdRef = useRef<string | null>(threadId ?? null);
  const turnCounterRef = useRef(0);
  // Only the newest queued turn is allowed to speak, so answers never pile up.
  const latestTurnRef = useRef("");
  const connectIdRef = useRef(0);
  const responseActiveRef = useRef(false);
  const userSpeakingRef = useRef(false);
  const processingRef = useRef(0);
  const seenItemsRef = useRef<Set<string>>(new Set());

  // Parent passes new function identities on every render. Keep the latest props
  // in a ref so our callbacks stay stable and never trigger a reconnect.
  const propsRef = useRef({ classId, lessonId, userId, onTurn, onClose });
  propsRef.current = { classId, lessonId, userId, onTurn, onClose };

  useEffect(() => {
    threadIdRef.current = threadId ?? threadIdRef.current;
  }, [threadId]);

  const addCaption = useCallback((text: string) => {
    if (!text || closedRef.current) return;
    setCaptions((prev) => [...prev.slice(-2), text]);
  }, []);

  const sendEvent = useCallback((payload: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") return false;
    dc.send(JSON.stringify(payload));
    return true;
  }, []);

  /** Stop whatever the voice is currently saying (server generation + buffered audio). */
  const silenceAssistant = useCallback(() => {
    if (responseActiveRef.current) {
      sendEvent({ type: "response.cancel" });
      responseActiveRef.current = false;
    }
    sendEvent({ type: "output_audio_buffer.clear" });
  }, [sendEvent]);

  /** Fully release the connection, microphone and speaker. Safe to call repeatedly. */
  const closeConnection = useCallback(() => {
    connectIdRef.current++; // invalidates any connect() still awaiting
    responseActiveRef.current = false;
    userSpeakingRef.current = false;

    try {
      dcRef.current?.close();
    } catch {}
    dcRef.current = null;

    const pc = pcRef.current;
    pcRef.current = null;
    try {
      pc?.getSenders().forEach((sender) => sender.track?.stop());
      pc?.getReceivers().forEach((receiver) => receiver.track?.stop());
      pc?.close();
    } catch {}

    micRef.current?.getTracks().forEach((track) => track.stop());
    micRef.current = null;

    const audioEl = audioElRef.current;
    audioElRef.current = null;
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.removeAttribute("src");
      audioEl.load();
    }
  }, []);

  const speakAssistantText = useCallback(
    (assistantText: string) => {
      // Never layer a new answer on top of one that is still playing.
      silenceAssistant();
      sendEvent({
        type: "response.create",
        response: {
          modalities: ["audio"],
          instructions: `Speak naturally to the student. Use this exact teaching response:\n\n${assistantText}`,
        },
      });
    },
    [sendEvent, silenceAssistant]
  );

  const processVoiceTurn = useCallback(
    async (transcript: string, turnId: string) => {
      const cleanTranscript = transcript.trim();
      if (!cleanTranscript || closedRef.current) return;

      processingRef.current++;
      setAgentState("thinking");
      addCaption(`You: ${cleanTranscript}`);

      try {
        const { classId, lessonId, userId } = propsRef.current;
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

        // Keep the chat transcript in sync even if the call has since ended.
        propsRef.current.onTurn({
          userText: data.userText,
          assistantText: data.assistantText,
          diagramData: data.diagramData ?? null,
          threadId: data.threadId,
        });

        // After "End conversation", a superseded turn, or while the student is
        // talking again, stay silent.
        if (
          closedRef.current ||
          latestTurnRef.current !== turnId ||
          userSpeakingRef.current
        ) {
          return;
        }

        addCaption(`Tutor: ${data.assistantText}`);
        setAgentState("speaking");
        speakAssistantText(data.assistantText);
      } catch (error) {
        if (closedRef.current) return;
        const message =
          error instanceof Error ? error.message : "Failed to process voice turn.";
        setErrorMsg(message);
        setConnectionStatus("error");
      } finally {
        processingRef.current = Math.max(0, processingRef.current - 1);
      }
    },
    [addCaption, speakAssistantText]
  );

  const queueVoiceTurn = useCallback(
    (transcript: string) => {
      const turnId = `turn-${Date.now()}-${turnCounterRef.current++}`;
      latestTurnRef.current = turnId;
      turnChainRef.current = turnChainRef.current
        .then(() => processVoiceTurn(transcript, turnId))
        .catch(() => {
          // preserve queue chain
        });
    },
    [processVoiceTurn]
  );

  const sendSessionConfig = useCallback(() => {
    sendEvent({
      type: "session.update",
      session: {
        type: "realtime",
        model: "gpt-realtime-2",
        output_modalities: ["audio"],
        audio: {
          input: {
            format: { type: "audio/pcm", rate: 24000 },
            // create_response:false stops the model from answering on its own;
            // only the backend tutor's text is ever spoken.
            turn_detection: {
              type: "semantic_vad",
              create_response: false,
              interrupt_response: true,
            },
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
    });
  }, [sendEvent]);

  const handleRealtimeEvent = useCallback(
    (raw: string) => {
      if (closedRef.current) return;
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
          // Barge-in: stop generation AND any audio already buffered for playback.
          userSpeakingRef.current = true;
          silenceAssistant();
          setAgentState("listening");
          break;
        case "input_audio_buffer.speech_stopped":
          userSpeakingRef.current = false;
          setAgentState("thinking");
          break;
        case "response.created":
          responseActiveRef.current = true;
          break;
        case "response.output_audio.delta":
          setAgentState("speaking");
          break;
        case "response.done":
          responseActiveRef.current = false;
          if (processingRef.current === 0) setAgentState("listening");
          break;
        case "conversation.item.done": {
          const item = event.item as
            | {
                id?: string;
                role?: string;
                content?: Array<{ type?: string; transcript?: string }>;
              }
            | undefined;
          if (!item || item.role !== "user" || !Array.isArray(item.content)) break;
          if (item.id) {
            if (seenItemsRef.current.has(item.id)) break; // ignore duplicate events
            seenItemsRef.current.add(item.id);
          }
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
    [queueVoiceTurn, sendSessionConfig, silenceAssistant]
  );

  const connect = useCallback(async () => {
    // Always start from a clean slate so two connections can never coexist.
    closeConnection();
    const myId = connectIdRef.current;
    const stale = () => closedRef.current || connectIdRef.current !== myId;

    closedRef.current = false;
    seenItemsRef.current.clear();
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
      audioElRef.current = audioEl;
      pc.ontrack = (e) => {
        if (stale()) return;
        audioEl.srcObject = e.streams[0];
      };

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Your browser can't access the microphone here. Voice mode needs a secure page: open the app at https://… or http://localhost (not an IP address)."
        );
      }
      const ms = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (stale()) {
        // Closed (or superseded) while the permission prompt was open.
        ms.getTracks().forEach((track) => track.stop());
        return;
      }
      micRef.current = ms;
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
      const answerSdp = await sdpRes.text();
      if (stale()) return;

      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (error) {
      if (stale()) return;
      closeConnection();
      setConnectionStatus("error");
      setErrorMsg(describeVoiceError(error));
    }
  }, [closeConnection, handleRealtimeEvent]);

  // Connect once on mount; fully tear everything down on unmount.
  useEffect(() => {
    void connect();
    return () => {
      closedRef.current = true;
      closeConnection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    // Silence immediately; the parent fades the overlay out afterwards.
    closedRef.current = true;
    closeConnection();
    propsRef.current.onClose();
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

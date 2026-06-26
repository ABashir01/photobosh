import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import {
  createRoom,
  finalizeRoom,
  getRoom,
  joinRoom,
  listBackgrounds,
  listTemplates,
  setBackground,
  setReady,
  setTemplate,
  startRoom,
  uploadShot,
} from "./api";
import { Lobby } from "./components/Lobby";
import { WaitingRoom } from "./components/WaitingRoom";
import { drawCompositePreview, captureTransparentPng, warmUpSegmenters } from "./lib/canvas";
import { loadSession, saveSession } from "./lib/session";
import { usePeerConnection } from "./hooks/usePeerConnection";
import { useRoomSocket } from "./hooks/useRoomSocket";
import { appReducer, initialAppState } from "./store";
import type { BackgroundDefinition, SessionRecord } from "./types";

function getRoomIdFromLocation(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("room");
}

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [displayName, setDisplayName] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [rtcConfig, setRtcConfig] = useState<RTCConfiguration | null>(null);
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const roomId = useMemo(() => getRoomIdFromLocation(), []);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const captureQueueRef = useRef<Set<number>>(new Set());
  const countdownTimersRef = useRef<number[]>([]);
  const countdownIntervalRef = useRef<number | null>(null);
  const countdownScheduleKeyRef = useRef<string | null>(null);

  const session = state.session;
  const roomState = state.roomState;
  const isHost = Boolean(session?.hostToken);
  const localParticipant = roomState?.participants.find((participant) => participant.id === session?.participantId) ?? null;

  function clearCountdownScheduling() {
    countdownTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    countdownTimersRef.current = [];
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }

  async function ensureLocalStream(): Promise<MediaStream> {
    if (localStream) {
      return localStream;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user",
      },
    });
    setLocalStream(stream);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      await localVideoRef.current.play().catch(() => undefined);
    }
    return stream;
  }

  useEffect(() => {
    void Promise.all([listBackgrounds(), listTemplates()]).then(([backgrounds, templates]) => {
      dispatch({ type: "set-assets", payload: { backgrounds, templates } });
    });
  }, []);

  useEffect(() => {
    if (!roomId) {
      return;
    }
    const saved = loadSession(roomId);
    if (saved) {
      dispatch({ type: "set-session", payload: saved });
      setDisplayName(saved.displayName);
      setRtcConfig(saved.rtcConfig ?? null);
      dispatch({ type: "bootstrap", payload: { joinUrl: `${window.location.origin}?room=${roomId}` } });
      void getRoom(roomId)
        .then((snapshot) => {
          dispatch({ type: "room-state", payload: snapshot });
        })
        .catch((error: Error) => {
          dispatch({ type: "set-error", payload: error.message });
        });
    }
  }, [roomId]);

  useEffect(() => {
    if (localStream || !session) {
      return;
    }
    ensureLocalStream()
      .then((stream) => {
        void stream;
      })
      .catch((error: Error) => {
        dispatch({ type: "set-error", payload: error.message });
      });
  }, [localStream, session]);

  const signalHandlerRef = useRef<(senderId: string, signal: unknown) => Promise<void>>(async () => undefined);

  const socketApi = useRoomSocket({
    roomId: roomState?.roomId ?? roomId,
    participantToken: session?.participantToken ?? null,
    onRoomState: (snapshot) => {
      dispatch({ type: "room-state", payload: snapshot });
      const participant = snapshot.participants.find((item) => item.id === session?.participantId);
      dispatch({ type: "set-ready", payload: participant?.ready ?? false });
    },
    onSignal: (senderId, signal) => {
      void signalHandlerRef.current(senderId, signal);
    },
    onError: (message) => {
      dispatch({ type: "set-error", payload: message });
    },
  });

  const { remoteStream, handleSignal } = usePeerConnection({
    participantId: session?.participantId ?? null,
    localStream,
    participants: roomState?.participants ?? [],
    rtcConfig,
    sendSignal: (targetParticipantId, signal) => socketApi.sendSignal(targetParticipantId, signal),
    sendPeerState: (peerState) => socketApi.sendPeerState(peerState),
  });

  useEffect(() => {
    signalHandlerRef.current = handleSignal;
  }, [handleSignal]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      void remoteVideoRef.current.play().catch(() => undefined);
    }
  }, [remoteStream]);

  useEffect(() => {
    return () => {
      clearCountdownScheduling();
    };
  }, []);

  useEffect(() => {
    let animationFrame = 0;
    let disposed = false;
    const background = state.backgrounds.find((item) => item.id === roomState?.selectedBackgroundId);

    const render = async () => {
      if (disposed || !previewCanvasRef.current) {
        return;
      }
      try {
        await warmUpSegmenters();
        await drawCompositePreview(
          previewCanvasRef.current,
          background as BackgroundDefinition | undefined,
          localVideoRef.current,
          remoteVideoRef.current,
        );
      } catch (error) {
        dispatch({
          type: "set-error",
          payload: error instanceof Error ? error.message : "Preview rendering failed.",
        });
      }
      animationFrame = window.setTimeout(() => {
        void render();
      }, 120) as unknown as number;
    };

    if (roomState && session) {
      void render();
    }

    return () => {
      disposed = true;
      window.clearTimeout(animationFrame);
    };
  }, [roomState, session, state.backgrounds]);

  useEffect(() => {
    if (!roomState || !session || roomState.phase !== "countdown" || roomState.shotSchedule.length !== 4) {
      clearCountdownScheduling();
      countdownScheduleKeyRef.current = null;
      if (roomState?.phase === "uploading" || roomState?.phase === "template_selection") {
        setCountdownText("Uploading shots...");
      } else {
        setCountdownText(null);
      }
      return;
    }
    const scheduleKey = `${roomState.roomId}:${roomState.shotSchedule.join(",")}`;
    if (countdownScheduleKeyRef.current === scheduleKey) {
      return;
    }

    clearCountdownScheduling();
    captureQueueRef.current.clear();
    countdownScheduleKeyRef.current = scheduleKey;

    roomState.shotSchedule.forEach((shotTime, shotIndex) => {
      const millisecondsUntilShot = Math.max(0, shotTime - Date.now());
      const timer = window.setTimeout(() => {
        captureQueueRef.current.add(shotIndex);
        setCountdownText(`Capturing shot ${shotIndex + 1} of 4...`);
        void captureAndUpload(shotIndex);
      }, millisecondsUntilShot);
      countdownTimersRef.current.push(timer);
    });

    const updateCountdownText = () => {
      const nextShotIndex = roomState.shotSchedule.findIndex(
        (timestamp, index) => timestamp > Date.now() && !captureQueueRef.current.has(index),
      );
      if (nextShotIndex === -1) {
        setCountdownText("Uploading shots...");
        return;
      }
      const seconds = Math.max(
        0,
        Math.ceil((roomState.shotSchedule[nextShotIndex] - Date.now()) / 1000),
      );
      setCountdownText(
        seconds > 0 ? `Shot ${nextShotIndex + 1} of 4 in ${seconds}...` : `Shot ${nextShotIndex + 1}...`,
      );
    };

    updateCountdownText();
    countdownIntervalRef.current = window.setInterval(updateCountdownText, 200);
  }, [roomState, session]);

  async function captureAndUpload(shotIndex: number) {
    if (!roomState || !session || !localVideoRef.current) {
      return;
    }
    const blob = await captureTransparentPng(localVideoRef.current);
    await uploadShot(roomState.roomId, session.participantToken, shotIndex, blob);
  }

  async function handleCreateRoom() {
    try {
      setIsBusy(true);
      await ensureLocalStream();
      const created = await createRoom();
      window.history.replaceState({}, "", `?room=${created.roomId}`);
      const joined = await joinRoom(created.roomId, displayName, created.hostToken);
      const nextSession: SessionRecord = {
        roomId: created.roomId,
        participantId: joined.participantId,
        participantToken: joined.participantToken,
        displayName,
        hostToken: created.hostToken,
        rtcConfig: joined.rtcConfig,
      };
      saveSession(nextSession);
      setRtcConfig(joined.rtcConfig);
      dispatch({ type: "set-session", payload: nextSession });
      dispatch({ type: "room-state", payload: joined.roomState });
      dispatch({ type: "bootstrap", payload: { joinUrl: created.joinUrl } });
    } catch (error) {
      dispatch({ type: "set-error", payload: (error as Error).message });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleJoinRoom() {
    if (!roomId) {
      return;
    }
    try {
      setIsBusy(true);
      await ensureLocalStream();
      const joined = await joinRoom(roomId, displayName);
      const nextSession: SessionRecord = {
        roomId,
        participantId: joined.participantId,
        participantToken: joined.participantToken,
        displayName,
        rtcConfig: joined.rtcConfig,
      };
      saveSession(nextSession);
      setRtcConfig(joined.rtcConfig);
      dispatch({ type: "set-session", payload: nextSession });
      dispatch({ type: "room-state", payload: joined.roomState });
      dispatch({ type: "bootstrap", payload: { joinUrl: `${window.location.origin}?room=${roomId}` } });
    } catch (error) {
      dispatch({ type: "set-error", payload: (error as Error).message });
    } finally {
      setIsBusy(false);
    }
  }

  async function toggleReady() {
    if (!roomState || !session) {
      return;
    }
    await setReady(roomState.roomId, session.participantToken, !state.localReady);
    dispatch({ type: "set-ready", payload: !state.localReady });
  }

  async function handleBackgroundSelect(backgroundId: string) {
    if (!roomState || !session?.hostToken) {
      return;
    }
    await setBackground(roomState.roomId, session.hostToken, backgroundId);
  }

  async function handleStart() {
    if (!roomState || !session?.hostToken) {
      return;
    }
    captureQueueRef.current.clear();
    await startRoom(roomState.roomId, session.hostToken);
  }

  async function handleTemplateSelect(templateId: string) {
    if (!roomState || !session?.hostToken) {
      return;
    }
    await setTemplate(roomState.roomId, session.hostToken, templateId);
  }

  async function handleFinalize() {
    if (!roomState || !session?.hostToken) {
      return;
    }
    await finalizeRoom(roomState.roomId, session.hostToken);
  }

  const shouldShowLobby = !session;

  return (
    <main className="app-shell">
      <video autoPlay muted playsInline ref={localVideoRef} style={{ display: "none" }} />
      <video autoPlay muted playsInline ref={remoteVideoRef} style={{ display: "none" }} />
      {shouldShowLobby ? (
        <Lobby
          displayName={displayName}
          isBusy={isBusy}
          onCreateRoom={handleCreateRoom}
          onDisplayNameChange={setDisplayName}
          onJoinRoom={handleJoinRoom}
          roomId={roomId}
        />
      ) : (
        <>
          <section className="stage panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Live booth</p>
                <h2>{countdownText ?? localParticipant?.displayName ?? "Preparing camera"}</h2>
              </div>
              <span className="pill pill--info">{roomState?.phase ?? "loading"}</span>
            </div>
            <canvas className="stage-canvas" ref={previewCanvasRef} />
          </section>
          {roomState ? (
            <WaitingRoom
              backgrounds={state.backgrounds}
              isHost={isHost}
              joinUrl={state.joinUrl}
              localReady={state.localReady}
              onBackgroundSelect={handleBackgroundSelect}
              onFinalize={handleFinalize}
              onStart={handleStart}
              onTemplateSelect={handleTemplateSelect}
              onToggleReady={toggleReady}
              roomState={roomState}
              templates={state.templates}
            />
          ) : null}
          {roomState?.finalStripUrl ? (
            <section className="panel final-panel">
              <img alt="Final photostrip" className="strip-preview" src={roomState.finalStripUrl} />
              <div className="controls-row">
                <a className="button-link" download href={roomState.finalStripUrl}>
                  Download strip
                </a>
                <button onClick={() => window.print()} type="button">
                  Print
                </button>
              </div>
            </section>
          ) : null}
        </>
      )}
      {state.error ? <aside className="error-banner">{state.error}</aside> : null}
    </main>
  );
}

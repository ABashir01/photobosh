import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import {
  createRoom,
  getRoom,
  joinRoom,
  listBackgrounds,
  listTemplates,
  setBackground,
  setReady,
  setTemplate,
  startRoom,
  uploadCompositeShot,
  uploadShot,
} from "./api";
import { CaptureScreen } from "./components/CaptureScreen";
import { CreateRoomScreen } from "./components/CreateRoomScreen";
import { ThemeSelectionScreen } from "./components/ThemeSelectionScreen";
import { WaitingLobbyScreen } from "./components/WaitingLobbyScreen";
import { usePeerConnection } from "./hooks/usePeerConnection";
import { useRoomSocket } from "./hooks/useRoomSocket";
import { drawCompositePreview, captureTransparentPng, warmUpSegmenters } from "./lib/canvas";
import { loadSession, saveSession } from "./lib/session";
import { appReducer, initialAppState } from "./store";
import type { BackgroundDefinition, SessionRecord } from "./types";

function getRoomIdFromLocation(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("room");
}

function getCaptureOverlay(countdownText: string | null): { primary: string | null; secondary: string | null } {
  if (!countdownText) {
    return { primary: null, secondary: null };
  }
  const secondsMatch = countdownText.match(/in\s+(\d+)/i);
  if (secondsMatch) {
    const shotMatch = countdownText.match(/Shot\s+(\d+)/i);
    return {
      primary: secondsMatch[1],
      secondary: shotMatch ? `Shot ${shotMatch[1]} of 4` : null,
    };
  }
  if (countdownText.startsWith("Capturing")) {
    return { primary: "SNAP", secondary: countdownText.replace("Capturing ", "") };
  }
  if (countdownText.startsWith("Uploading")) {
    return { primary: "UPLOADING", secondary: "Processing your strip" };
  }
  const shotMatch = countdownText.match(/Shot\s+(\d+)/i);
  if (shotMatch) {
    return { primary: "SMILE", secondary: `Shot ${shotMatch[1]} of 4` };
  }
  return { primary: countdownText.toUpperCase(), secondary: null };
}

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [displayName, setDisplayName] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [rtcConfig, setRtcConfig] = useState<RTCConfiguration | null>(null);
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const roomId = useMemo(() => getRoomIdFromLocation(), []);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const captureQueueRef = useRef<Set<number>>(new Set());
  const countdownTimersRef = useRef<number[]>([]);
  const countdownIntervalRef = useRef<number | null>(null);
  const countdownScheduleKeyRef = useRef<string | null>(null);
  const inviteFeedbackTimerRef = useRef<number | null>(null);

  const session = state.session;
  const roomState = state.roomState;
  const isHost = Boolean(session?.hostToken);
  const localParticipant = roomState?.participants.find((participant) => participant.id === session?.participantId) ?? null;
  const captureOverlay = useMemo(() => getCaptureOverlay(countdownText), [countdownText]);
  const activeStripUrl = roomState?.finalStripUrl ?? roomState?.previewStripUrl ?? null;
  const canShareInvite = typeof navigator !== "undefined" && typeof navigator.share === "function";

  function setInviteFeedbackMessage(message: string) {
    setInviteFeedback(message);
    if (inviteFeedbackTimerRef.current !== null) {
      window.clearTimeout(inviteFeedbackTimerRef.current);
    }
    inviteFeedbackTimerRef.current = window.setTimeout(() => {
      setInviteFeedback(null);
      inviteFeedbackTimerRef.current = null;
    }, 2200);
  }

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
    ensureLocalStream().catch((error: Error) => {
      dispatch({ type: "set-error", payload: error.message });
    });
  }, [localStream, session]);

  useEffect(() => {
    dispatch({ type: "set-ready", payload: localParticipant?.ready ?? false });
  }, [localParticipant?.ready]);

  useEffect(() => {
    return () => {
      clearCountdownScheduling();
      if (inviteFeedbackTimerRef.current !== null) {
        window.clearTimeout(inviteFeedbackTimerRef.current);
      }
    };
  }, []);

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
      if (roomState?.phase === "uploading") {
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
    try {
      if (session.hostToken && previewCanvasRef.current) {
        const compositeBlob = await new Promise<Blob>((resolve, reject) => {
          previewCanvasRef.current?.toBlob((blob) => {
            if (!blob) {
              reject(new Error("Failed to capture booth frame."));
              return;
            }
            resolve(blob);
          }, "image/png");
        });
        await uploadCompositeShot(roomState.roomId, session.hostToken, shotIndex, compositeBlob);
      }
      const blob = await captureTransparentPng(localVideoRef.current);
      await uploadShot(roomState.roomId, session.participantToken, shotIndex, blob);
    } catch (error) {
      dispatch({
        type: "set-error",
        payload: error instanceof Error ? error.message : `Shot ${shotIndex + 1} upload failed.`,
      });
    }
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

  async function handleCopyInvite() {
    if (!state.joinUrl) {
      return;
    }
    await navigator.clipboard.writeText(state.joinUrl);
    setInviteFeedbackMessage("Invite link copied.");
  }

  async function handleShareInvite() {
    if (!state.joinUrl || typeof navigator.share !== "function") {
      return;
    }
    try {
      await navigator.share({
        title: "Join my Photobosh room",
        url: state.joinUrl,
      });
      setInviteFeedbackMessage("Invite link ready to send.");
    } catch {
      // Ignore canceled share sheets.
    }
  }

  const shouldShowCreateRoom = !session;
  const isCapturePhase = roomState?.phase === "countdown" || roomState?.phase === "uploading";
  const isThemePhase = roomState?.phase === "template_selection" || roomState?.phase === "final_ready";

  return (
    <main className="app-shell">
      <video autoPlay muted playsInline ref={localVideoRef} style={{ display: "none" }} />
      <video autoPlay muted playsInline ref={remoteVideoRef} style={{ display: "none" }} />

      {shouldShowCreateRoom ? (
        <CreateRoomScreen
          displayName={displayName}
          isBusy={isBusy}
          onDisplayNameChange={setDisplayName}
          onSubmit={roomId ? handleJoinRoom : handleCreateRoom}
          roomId={roomId}
        />
      ) : roomState ? (
        isCapturePhase ? (
          <CaptureScreen
            boothCanvasRef={previewCanvasRef}
            overlayPrimary={captureOverlay.primary}
            overlaySecondary={captureOverlay.secondary}
          />
        ) : isThemePhase ? (
          <ThemeSelectionScreen
            downloadUrl={activeStripUrl}
            isHost={isHost}
            onTemplateSelect={handleTemplateSelect}
            previewStripUrl={roomState.previewStripUrl ?? activeStripUrl}
            selectedTemplateId={roomState.selectedTemplateId}
            templates={state.templates}
          />
        ) : (
          <WaitingLobbyScreen
            backgrounds={state.backgrounds}
            boothCanvasRef={previewCanvasRef}
            canShareInvite={canShareInvite}
            inviteFeedback={inviteFeedback}
            isHost={isHost}
            joinUrl={state.joinUrl}
            localReady={state.localReady}
            onBackgroundSelect={handleBackgroundSelect}
            onCopyInvite={handleCopyInvite}
            onShareInvite={handleShareInvite}
            onStart={handleStart}
            onToggleReady={toggleReady}
            roomState={roomState}
          />
        )
      ) : (
        <section className="screen screen--create">
          <div className="create-hero">
            <p className="create-hero__index">...</p>
            <h1>Loading room…</h1>
          </div>
        </section>
      )}

      {state.error ? <aside className="error-banner">{state.error}</aside> : null}
    </main>
  );
}

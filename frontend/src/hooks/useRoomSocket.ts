import { useEffect, useRef } from "react";

import type { RoomStateSnapshot } from "../types";

type SignalHandler = (senderId: string, signal: unknown) => void;

type Options = {
  roomId: string | null;
  participantToken: string | null;
  onRoomState: (roomState: RoomStateSnapshot) => void;
  onSignal: SignalHandler;
  onError: (message: string) => void;
};

type SocketApi = {
  sendSignal: (targetParticipantId: string, signal: unknown) => void;
  sendPeerState: (state: string) => void;
};

export function useRoomSocket({
  roomId,
  participantToken,
  onRoomState,
  onSignal,
  onError,
}: Options): SocketApi {
  const socketRef = useRef<WebSocket | null>(null);
  const onRoomStateRef = useRef(onRoomState);
  const onSignalRef = useRef(onSignal);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onRoomStateRef.current = onRoomState;
    onSignalRef.current = onSignal;
    onErrorRef.current = onError;
  }, [onError, onRoomState, onSignal]);

  useEffect(() => {
    if (!roomId || !participantToken) {
      return;
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const base = `${protocol}//${window.location.host}/ws/rooms/${roomId}?token=${encodeURIComponent(participantToken)}`;
    const socket = new WebSocket(base);
    socketRef.current = socket;
    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data) as {
        type: string;
        participantId?: string;
        payload?: { roomState?: RoomStateSnapshot; signal?: unknown };
      };
      if (payload.type === "room.state" && payload.payload?.roomState) {
        onRoomStateRef.current(payload.payload.roomState);
      }
      if (payload.type === "room.signal" && payload.participantId && payload.payload?.signal) {
        onSignalRef.current(payload.participantId, payload.payload.signal);
      }
    });
    socket.addEventListener("close", () => {
      onErrorRef.current("Realtime connection closed.");
    });
    socket.addEventListener("error", () => {
      onErrorRef.current("Realtime connection failed.");
    });
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [participantToken, roomId]);

  return {
    sendSignal(targetParticipantId, signal) {
      socketRef.current?.send(
        JSON.stringify({ type: "signal", payload: { targetParticipantId, signal } }),
      );
    },
    sendPeerState(state) {
      socketRef.current?.send(JSON.stringify({ type: "peer-state", payload: { state } }));
    },
  };
}

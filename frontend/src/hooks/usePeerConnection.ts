import { useEffect, useRef, useState } from "react";

import type { ParticipantSnapshot } from "../types";

type Options = {
  participantId: string | null;
  localStream: MediaStream | null;
  participants: ParticipantSnapshot[];
  rtcConfig: RTCConfiguration | null;
  sendSignal: (targetParticipantId: string, signal: unknown) => void;
  sendPeerState: (state: string) => void;
};

type SignalPayload = {
  type: "offer" | "answer" | "candidate";
  sdp?: string;
  candidate?: RTCIceCandidateInit;
};

export function usePeerConnection({
  participantId,
  localStream,
  participants,
  rtcConfig,
  sendSignal,
  sendPeerState,
}: Options) {
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const sendSignalRef = useRef(sendSignal);
  const sendPeerStateRef = useRef(sendPeerState);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const remoteParticipant = participants.find((participant) => participant.id !== participantId) ?? null;
  const sortedParticipantIds = participants.map((participant) => participant.id);
  const isInitiator = participantId ? sortedParticipantIds[0] === participantId : false;
  const remoteParticipantId = remoteParticipant?.id ?? null;
  const remoteSocketConnected = remoteParticipant?.connectionState === "connected";

  useEffect(() => {
    sendSignalRef.current = sendSignal;
    sendPeerStateRef.current = sendPeerState;
  }, [sendPeerState, sendSignal]);

  useEffect(() => {
    if (!participantId || !localStream || !remoteParticipantId || !rtcConfig || !remoteSocketConnected) {
      return;
    }
    if (connectionRef.current) {
      return;
    }
    const connection = new RTCPeerConnection(rtcConfig);
    connectionRef.current = connection;
    localStream.getTracks().forEach((track) => connection.addTrack(track, localStream));
    const inboundStream = new MediaStream();
    setRemoteStream(inboundStream);
    connection.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => inboundStream.addTrack(track));
      sendPeerStateRef.current("connected");
    };
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalRef.current(remoteParticipantId, { type: "candidate", candidate: event.candidate.toJSON() });
      }
    };
    connection.onconnectionstatechange = () => {
      sendPeerStateRef.current(connection.connectionState);
    };
    if (isInitiator) {
      void (async () => {
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        sendSignalRef.current(remoteParticipantId, { type: "offer", sdp: offer.sdp });
      })();
    }

    return () => {
      connection.close();
      connectionRef.current = null;
      setRemoteStream(null);
    };
  }, [isInitiator, localStream, participantId, remoteParticipantId, remoteSocketConnected, rtcConfig]);

  const handleSignal = async (senderId: string, signal: unknown) => {
    if (!connectionRef.current || !remoteParticipantId || senderId !== remoteParticipantId) {
      return;
    }
    const payload = signal as SignalPayload;
    if (payload.type === "offer" && payload.sdp) {
      await connectionRef.current.setRemoteDescription({ type: "offer", sdp: payload.sdp });
      const answer = await connectionRef.current.createAnswer();
      await connectionRef.current.setLocalDescription(answer);
      sendSignalRef.current(remoteParticipantId, { type: "answer", sdp: answer.sdp });
    } else if (payload.type === "answer" && payload.sdp) {
      await connectionRef.current.setRemoteDescription({ type: "answer", sdp: payload.sdp });
    } else if (payload.type === "candidate" && payload.candidate) {
      await connectionRef.current.addIceCandidate(payload.candidate);
    }
  };

  return { remoteStream, handleSignal };
}

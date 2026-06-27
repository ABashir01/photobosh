import type { RefObject } from "react";

import type { BackgroundDefinition, RoomStateSnapshot } from "../types";

type Props = {
  roomState: RoomStateSnapshot;
  isHost: boolean;
  joinUrl: string | null;
  localReady: boolean;
  backgrounds: BackgroundDefinition[];
  onToggleReady: () => void;
  onBackgroundSelect: (backgroundId: string) => void;
  onStart: () => void;
  onCopyInvite: () => void;
  onShareInvite: () => void;
  canShareInvite: boolean;
  inviteFeedback: string | null;
  boothCanvasRef: RefObject<HTMLCanvasElement | null>;
};

function participantLabel(connectionState: string, ready: boolean): string {
  if (connectionState !== "connected") {
    return "offline";
  }
  if (ready) {
    return "ready";
  }
  return "waiting";
}

export function WaitingLobbyScreen({
  roomState,
  isHost,
  joinUrl,
  localReady,
  backgrounds,
  onToggleReady,
  onBackgroundSelect,
  onStart,
  onCopyInvite,
  onShareInvite,
  canShareInvite,
  inviteFeedback,
  boothCanvasRef,
}: Props) {
  const canStart =
    isHost &&
    roomState.participants.length === 2 &&
    roomState.participants.every(
      (participant) => participant.connectionState === "connected" && participant.ready,
    );

  return (
    <section className="screen screen--lobby">
      <header className="screen__masthead">
        <p className="wordmark">photobosh</p>
        <div className="screen__meta">
          <span>Room {roomState.roomId}</span>
          <span>02</span>
        </div>
      </header>

      <div className="booth-shell">
        <canvas className="stage-canvas" ref={boothCanvasRef} />
      </div>

      <div className="lobby-block">
        <div className="lobby-block__header">
          <h2>Invite someone in</h2>
          <p>Everyone sees the same staged booth before the countdown begins.</p>
        </div>
        <div className="invite-row">
          <code>{joinUrl ?? "Preparing invite link..."}</code>
          <div className="invite-row__actions">
            <button className="button button--secondary" onClick={onCopyInvite} type="button">
              Copy link
            </button>
            {canShareInvite ? (
              <button className="button button--ghost" onClick={onShareInvite} type="button">
                Share
              </button>
            ) : null}
          </div>
        </div>
        {inviteFeedback ? <p className="microcopy">{inviteFeedback}</p> : null}
      </div>

      <div className="lobby-block">
        <div className="lobby-block__header">
          <h2>People</h2>
        </div>
        <div className="participant-list">
          {roomState.participants.map((participant) => (
            <div className="participant-row" key={participant.id}>
              <div>
                <strong>{participant.displayName}</strong>
                <span>{participant.isHost ? "host" : "guest"}</span>
              </div>
              <span className={`status-pill status-pill--${participantLabel(participant.connectionState, participant.ready)}`}>
                {participantLabel(participant.connectionState, participant.ready)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="lobby-block">
        <div className="lobby-block__header">
          <h2>Shared background</h2>
          <p>{isHost ? "Pick the staged scene for both people." : "The host controls the staged scene."}</p>
        </div>
        <div className="background-rail" role="list">
          {backgrounds.map((background) => (
            <button
              aria-pressed={background.id === roomState.selectedBackgroundId}
              className={background.id === roomState.selectedBackgroundId ? "background-chip is-active" : "background-chip"}
              disabled={!isHost}
              key={background.id}
              onClick={() => onBackgroundSelect(background.id)}
              style={{
                background: `linear-gradient(180deg, ${background.gradient[0]}, ${background.gradient[1]})`,
              }}
              type="button"
            >
              <span>{background.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="action-bar">
        <button className="button button--secondary" onClick={onToggleReady} type="button">
          {localReady ? "Not ready" : "Ready"}
        </button>
        {isHost ? (
          <button className="button button--primary" disabled={!canStart} onClick={onStart} type="button">
            Start booth
          </button>
        ) : null}
      </div>
    </section>
  );
}

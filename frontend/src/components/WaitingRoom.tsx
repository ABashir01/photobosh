import type { BackgroundDefinition, ParticipantSnapshot, RoomStateSnapshot, TemplateDefinition } from "../types";

type Props = {
  roomState: RoomStateSnapshot;
  isHost: boolean;
  joinUrl: string | null;
  localReady: boolean;
  backgrounds: BackgroundDefinition[];
  templates: TemplateDefinition[];
  onToggleReady: () => void;
  onBackgroundSelect: (backgroundId: string) => void;
  onStart: () => void;
  onTemplateSelect: (templateId: string) => void;
  onFinalize: () => void;
};

function participantStatus(participant: ParticipantSnapshot): string {
  if (participant.connectionState !== "connected") {
    return "offline";
  }
  if (participant.ready) {
    return "ready";
  }
  return "waiting";
}

export function WaitingRoom({
  roomState,
  isHost,
  joinUrl,
  localReady,
  backgrounds,
  templates,
  onToggleReady,
  onBackgroundSelect,
  onStart,
  onTemplateSelect,
  onFinalize,
}: Props) {
  const canStart =
    isHost &&
    roomState.phase === "waiting_room" &&
    roomState.participants.length === 2 &&
    roomState.participants.every((participant) => participant.ready);

  return (
    <div className="waiting-room">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Room</p>
            <h2>{roomState.roomId}</h2>
          </div>
          {joinUrl ? (
            <button
              className="secondary"
              onClick={() => navigator.clipboard.writeText(joinUrl)}
              type="button"
            >
              Copy invite link
            </button>
          ) : null}
        </div>
        <div className="participant-grid">
          {roomState.participants.map((participant) => (
            <article className="participant-card" key={participant.id}>
              <strong>{participant.displayName}</strong>
              <span>{participant.isHost ? "Host" : "Guest"}</span>
              <span className={`pill pill--${participantStatus(participant)}`}>
                {participantStatus(participant)}
              </span>
            </article>
          ))}
        </div>
        <div className="controls-row">
          <button onClick={onToggleReady} type="button">
            {localReady ? "Mark not ready" : "Mark ready"}
          </button>
          {isHost && roomState.phase === "waiting_room" ? (
            <button disabled={!canStart} onClick={onStart} type="button">
              Start booth
            </button>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Backdrop</p>
            <h3>Shared background</h3>
          </div>
        </div>
        <div className="swatch-grid">
          {backgrounds.map((background) => (
            <button
              className={background.id === roomState.selectedBackgroundId ? "swatch active" : "swatch"}
              disabled={!isHost || roomState.phase !== "waiting_room"}
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
      </section>

      {roomState.phase === "template_selection" || roomState.phase === "final_ready" ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Photostrip</p>
              <h3>Choose the final theme</h3>
            </div>
          </div>
          <div className="swatch-grid swatch-grid--templates">
            {templates.map((template) => (
              <button
                className={template.id === roomState.selectedTemplateId ? "swatch active" : "swatch"}
                disabled={!isHost || roomState.phase !== "template_selection"}
                key={template.id}
                onClick={() => onTemplateSelect(template.id)}
                style={{
                  background: template.paperColor,
                  borderColor: template.accentColor,
                  color: template.textColor,
                }}
                type="button"
              >
                <span>{template.name}</span>
              </button>
            ))}
          </div>
          {roomState.previewStripUrl ? (
            <img alt="Preview strip" className="strip-preview" src={roomState.previewStripUrl} />
          ) : null}
          {isHost && roomState.phase === "template_selection" ? (
            <button onClick={onFinalize} type="button">
              Finalize strip
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}


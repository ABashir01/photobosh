import type { FormEvent } from "react";

type Props = {
  roomId: string | null;
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  onSubmit: () => void;
  isBusy: boolean;
};

export function CreateRoomScreen({
  roomId,
  displayName,
  onDisplayNameChange,
  onSubmit,
  isBusy,
}: Props) {
  const submitLabel = roomId ? "Join room" : "Create room";

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="screen screen--create">
      <div className="screen__masthead">
        <p className="wordmark">photobosh</p>
        <p className="screen__kicker">{roomId ? "Join an existing booth" : "Shared remote photobooth"}</p>
      </div>

      <div className="create-hero">
        <p className="create-hero__index">01</p>
        <h1>{roomId ? "Join the room and step into the booth." : "Create a room and invite someone in."}</h1>
        <p className="create-hero__lede">
          The flow stays simple: invite, ready up, capture four shots, then switch strip themes and download.
        </p>
      </div>

      <form className="create-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Your name</span>
          <input
            value={displayName}
            onChange={(event) => onDisplayNameChange(event.target.value)}
            placeholder="Enter your display name"
            maxLength={40}
            required
          />
        </label>
        <button className="button button--primary" disabled={isBusy || !displayName.trim()} type="submit">
          {submitLabel}
        </button>
      </form>
    </section>
  );
}

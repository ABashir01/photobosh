import type { FormEvent } from "react";

type Props = {
  roomId: string | null;
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  isBusy: boolean;
};

export function Lobby({ roomId, displayName, onDisplayNameChange, onCreateRoom, onJoinRoom, isBusy }: Props) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (roomId) {
      onJoinRoom();
    } else {
      onCreateRoom();
    }
  };

  return (
    <section className="panel panel--hero">
      <div>
        <p className="eyebrow">Remote photobooth MVP</p>
        <h1>Stage two people into one booth, then print the strip.</h1>
        <p className="lede">
          Create a room, invite someone in, pick the backdrop, and run a four-shot booth session
          together.
        </p>
      </div>
      <form className="lobby-form" onSubmit={submit}>
        <label>
          Display name
          <input
            value={displayName}
            onChange={(event) => onDisplayNameChange(event.target.value)}
            placeholder="Your name"
            maxLength={40}
            required
          />
        </label>
        <button disabled={isBusy || !displayName.trim()} type="submit">
          {roomId ? "Join room" : "Create room"}
        </button>
      </form>
    </section>
  );
}


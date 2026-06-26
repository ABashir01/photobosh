import { describe, expect, it } from "vitest";

import { appReducer, initialAppState } from "./store";

describe("appReducer", () => {
  it("stores room state snapshots", () => {
    const nextState = appReducer(initialAppState, {
      type: "room-state",
      payload: {
        roomId: "abc123",
        phase: "waiting_room",
        participants: [],
        selectedBackgroundId: "dusk-lounge",
        selectedTemplateId: "sunset-strip",
        previewStripUrl: null,
        shotSchedule: [],
        uploadsReceived: {},
        finalStripUrl: null,
        expiresAt: Date.now() + 60_000,
      },
    });
    expect(nextState.roomState?.roomId).toBe("abc123");
  });

  it("tracks local readiness", () => {
    const nextState = appReducer(initialAppState, {
      type: "set-ready",
      payload: true,
    });
    expect(nextState.localReady).toBe(true);
  });
});


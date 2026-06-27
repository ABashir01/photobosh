import type { RefObject } from "react";

type Props = {
  boothCanvasRef: RefObject<HTMLCanvasElement | null>;
  overlayPrimary: string | null;
  overlaySecondary: string | null;
};

export function CaptureScreen({ boothCanvasRef, overlayPrimary, overlaySecondary }: Props) {
  return (
    <section className="screen screen--capture">
      <div className="capture-stage">
        <canvas className="stage-canvas stage-canvas--capture" ref={boothCanvasRef} />
        {overlayPrimary ? (
          <div className="capture-overlay">
            <p className="capture-overlay__primary">{overlayPrimary}</p>
            {overlaySecondary ? <p className="capture-overlay__secondary">{overlaySecondary}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

import type { CSSProperties } from "react";

import type { TemplateDefinition } from "../types";

type Props = {
  templates: TemplateDefinition[];
  selectedTemplateId: string | null;
  previewStripUrl: string | null;
  downloadUrl: string | null;
  isHost: boolean;
  onTemplateSelect: (templateId: string) => void;
};

export function ThemeSelectionScreen({
  templates,
  selectedTemplateId,
  previewStripUrl,
  downloadUrl,
  isHost,
  onTemplateSelect,
}: Props) {
  return (
    <section className="screen screen--theme">
      <header className="screen__masthead">
        <p className="wordmark">photobosh</p>
        <p className="screen__kicker">04</p>
      </header>

      <div className="theme-heading">
        <h1>Choose your strip.</h1>
        <p>The preview updates live. Download the current selection any time.</p>
      </div>

      <div className="strip-stage">
        {previewStripUrl ? <img alt="Current strip preview" className="strip-preview" src={previewStripUrl} /> : null}
      </div>

      <div className="theme-rail" role="list">
        {templates.map((template) => (
          <button
            aria-pressed={template.id === selectedTemplateId}
            className={template.id === selectedTemplateId ? "theme-chip is-active" : "theme-chip"}
            disabled={!isHost}
            key={template.id}
            onClick={() => onTemplateSelect(template.id)}
            style={
              {
                "--theme-paper": template.paperColor,
                "--theme-accent": template.accentColor,
                "--theme-panel": template.panelColor,
                "--theme-text": template.textColor,
              } as CSSProperties
            }
            type="button"
          >
            <span className="theme-chip__mini">
              <span />
              <span />
              <span />
            </span>
            <span className="theme-chip__label">{template.name}</span>
          </button>
        ))}
      </div>

      {downloadUrl ? (
        <a className="button button--primary button--download" download href={downloadUrl}>
          Download strip
        </a>
      ) : null}
    </section>
  );
}

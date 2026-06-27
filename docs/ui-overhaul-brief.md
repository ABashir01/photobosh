# Photobosh UI Overhaul Brief

## Goal

Replace the current control-panel layout with a mobile-first step flow that feels like a product, not a dashboard.

The approved interaction model should be:

1. Create room
2. Waiting lobby
3. Photobooth capture
4. Theme selection and download

## Flow Rules

### 1. Create room

- Keep the screen sparse.
- Show only the core action to create or join the session.
- Do not expose background, theme, or room metadata here.

### 2. Waiting lobby

- Show the live booth preview first.
- Keep only these controls visible:
  - invite link
  - participant readiness
  - shared background selection
  - host start action
- Do not show template selection here.

### 3. Photobooth capture

- The booth view should dominate the screen.
- The countdown should be the only obvious overlay.
- Hide room status, links, background pickers, and participant metadata during capture.

### 4. Theme selection and download

- Show the strip preview as the primary element.
- Theme switching should update the preview live.
- The host should not need a separate finalize step.
- Remove print affordances from the MVP UI.
- Allow repeated downloads while switching themes.

## Anti-Drift Rules

- Do not fall back to a generic SaaS dashboard.
- Do not use a page full of rounded panels over a decorative background.
- Do not show controls from previous or future steps on the current step.
- Do not make desktop the main composition target. Mobile comes first.
- Do not add bright gradients unless a specific visual direction explicitly calls for them.

## Design Concepts

### Concept A: Editorial Monochrome

- Source image: [concept-a-editorial-monochrome.png](/C:/Users/ahadb/Desktop/coding-projects/photobosh/docs/mockups/concept-a-editorial-monochrome.png)
- White background, black typography, light gray separators.
- Minimal framing, nearly no cards.
- Strongest fit for a simple, modern, non-generic product.

### Concept B: Kiosk Noir

- Source image: [concept-b-kiosk-noir.png](/C:/Users/ahadb/Desktop/coding-projects/photobosh/docs/mockups/concept-b-kiosk-noir.png)
- Black interface with physical photobooth energy.
- Capture step feels the most immersive.
- Strongest if the product should feel like a machine or booth rather than a website.

### Concept C: Photo Lab

- Source image: [concept-c-photo-lab.png](/C:/Users/ahadb/Desktop/coding-projects/photobosh/docs/mockups/concept-c-photo-lab.png)
- Off-white paper tone, thin rules, proof-sheet references.
- Feels more tactile and editorial than app-like.
- Best if the strip-selection step should feel like choosing physical proofs.

## Recommendation

Use Concept A as the base system and borrow one behavior from Concept B:

- Adopt Concept A for the overall product shell, typography, spacing, and screen hierarchy.
- Borrow Concept B's immersive full-screen treatment for the capture step.

That combination is the most likely to stay clean on mobile while avoiding the current dashboard look.

## Implementation Notes

- Prefer one primary vertical column on mobile.
- Treat each step as its own screen composition, not one reusable panel layout.
- Keep the live booth surface visually dominant in both the lobby and capture steps.
- Theme selection should look like a strip browser, not a settings form.
- If a strip background color control is added later, implement it as a short row of paper-tone chips under the strip preview.

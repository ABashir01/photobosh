# Design Reference

- Approved direction: combine [concept-a-editorial-monochrome.png](/C:/Users/ahadb/Desktop/coding-projects/photobosh/docs/mockups/concept-a-editorial-monochrome.png) with the immersive capture treatment from [concept-b-kiosk-noir.png](/C:/Users/ahadb/Desktop/coding-projects/photobosh/docs/mockups/concept-b-kiosk-noir.png).
- Primary breakpoint: mobile-first, with review centered on `390x844`.
- Current implementation is disposable if it conflicts with this structure.

## Source Of Truth

The UI should read as a sequence of distinct screens, not one dashboard with different sections.

Required flow:

1. Create room
2. Waiting lobby
3. Photobooth capture
4. Theme selection and download

## Anti-Goals

- No glassmorphism.
- No large grid of cards over a decorative background.
- No showing future-step controls on earlier screens.
- No print button or separate finalize button in the theme-selection step.

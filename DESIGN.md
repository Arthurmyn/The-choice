# Design system: ECHO

**World.** A playable psychological thriller: dark rooms at night, lit by blue light, rain on glass. Cinematic and quiet; the interface recedes, the scene leads.

**Colour.** Background `#080B10`, secondary `#111B27`, elevated `#172433`, steel `#20364A`. Accent blue `#65B9FF` is the only active colour (selection, path, focus, primary action). Memory amber `#B58B68` appears only on things the player has found (fragments, key findings, archive). Text `#E8EDF3`, secondary `#8C9AA8`. No green/red for choices.

**Type.** Space Grotesk Variable: light (300), wide-tracked uppercase for titles (ECHO at 0.42em); medium for headings. Manrope Variable for dialogue and body (measure ≤ 68ch). Small uppercase labels are used for meta information, not as kickers above headings.

**Signature.** Concentric echo rings around a point of light (menu, loading). Corner brackets mark the selected or focused panel. Hairline borders, not boxes within boxes.

**Motion.** One authored moment per screen: title blur-in, staggered decision panels, drawn-on path. Exponential ease-out (`cubic-bezier(0.23,1,0.32,1)`). Camera drift and pointer parallax are decorative and switch off with reduced motion. Frequent actions (dialogue advance, keyboard selection) are not animated beyond a 300ms line fade.

**Depth.** Scenes are layered SVG with bloom, light sweep, rain and grain. Glass is used only where text sits over a scene.

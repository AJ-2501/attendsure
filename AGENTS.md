<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Permanent Performance & Low-Latency Rules (Strict Zero UI/UX Impact)

1. **Zero UI/UX Side Effects**: Performance optimizations must NEVER alter visual design, Tailwind styles, layouts, copy, animations, 3D visuals/camera angles, or user flows unless explicitly requested. Exception: responsive/mobile fixes that implement the Mobile-First UI & UX Standards below are allowed, provided the visual theme, colors and desktop layout stay the same.
2. **No Query Waterfalls**: Never chain independent `await` calls in Server Components, Route Handlers (`src/app/api/`), or services (`src/lib/services/`). Always execute independent Supabase queries in parallel using `Promise.all()`.
3. **Request Deduplication**: Wrap shared read functions (e.g., auth/profile resolution, `getEventById`, `getEventBySlug`) in React `cache()` so repeated calls within a single request hit memory instead of Supabase.
4. **Minimal Round-Trips & Indexed Queries**: Keep hot paths (QR check-in, registration, attendance queries) to the minimum possible DB round-trips, and ensure filtered/sorted columns (`event_id`, `student_id`, `status`, `starts_at`) are backed by database indexes.
5. **60 FPS 3D & WebGL (`src/components/PassScanScene.tsx`, `src/components/SealScene.tsx`, and any future three.js scene)**:
   - Pause `requestAnimationFrame` / `setAnimationLoop` loops when the canvas is offscreen (`IntersectionObserver`) or the tab is hidden (`document.hidden`).
   - Cap pixel ratio with `Math.min(window.devicePixelRatio, 2)`.
   - Never allocate new `THREE.Vector3` / `Matrix4` / `Color` instances inside `requestAnimationFrame` loops; reuse pre-allocated instances.
   - Dispose all geometries, materials, textures, and renderers on unmount.
6. **Lean Client Bundles & Render Loops**:
   - Code-split heavy client-only libraries (`three`, `@zxing/browser`, `recharts`) while preserving identical visual output.
   - Keep high-frequency loops (camera frames, mouse/scroll tracking) in `useRef` rather than `useState` to prevent unnecessary React re-renders.

## Permanent Mobile-First UI & UX Standards

1. **Touch-Friendly Targets**: All interactive elements (buttons, inputs, tabs, links, scanner controls, icon buttons) must have a minimum tap target of `44x44px` (`min-h-11`) with comfortable spacing (`gap-2` or `gap-3`) to prevent mis-taps on mobile screens.
2. **Zero Horizontal Overflow**: Every page, table, modal, and card must fit cleanly down to `320px–375px` viewport widths with zero unintended horizontal page scroll (`overflow-x-hidden` on containers, responsive flex/grid wrapping, and `min-w-0` + `truncate` or `break-words` on long text/emails/IDs).
3. **Mobile-Optimized Forms & Inputs**:
   - Always use at least `16px` (`text-base` on mobile, `sm:text-sm` on desktop) on `<input>`, `<select>`, and `<textarea>` to prevent iOS Safari from auto-zooming on focus.
   - Use appropriate mobile keyboard attributes (`inputMode="numeric"`, `type="email"`, `autoComplete`, `enterKeyHint`) for student IDs, emails, and search fields.
   - Stack multi-column form grids into a single column (`grid-cols-1 sm:grid-cols-2`) on mobile with sticky or easily reachable primary submit buttons.
4. **Student QR Pass & Admin Mobile Scanner UX**:
   - Ensure the Student QR code pass scales cleanly inside small viewports without clipping, with high-contrast padding so scanners read it instantly in bright/dim lighting.
   - Make the QR Camera Scanner view thumb-friendly on phones: full-width responsive viewfinder, easy camera-switch/torch controls within thumb reach, and clear non-blocking status feedback.
5. **Responsive Tables, Dashboards & Navigation**:
   - Convert wide admin data tables and event lists on mobile either into scannable stacked cards (`block md:table`) or smooth horizontal scroll containers (`overflow-x-auto -mx-4 px-4`) with sticky key columns so data is never squished or cut off.
   - Respect mobile safe areas (`pb-[env(safe-area-inset-bottom)]`) and use dynamic viewport height (`min-h-dvh` instead of `100vh`) so mobile browser address bars never cover footer actions.
6. **Responsive 3D & Hero Layouts**:
   - Scale 3D scenes (`PassScanScene.tsx`, `SealScene.tsx`) and hero typography gracefully on narrow screens (`text-2xl sm:text-4xl lg:text-5xl`, compact mobile canvas heights) so key actions (Sign Up, Login, View Pass) stay above the fold without excessive scrolling.

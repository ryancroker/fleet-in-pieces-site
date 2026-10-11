# Ship workshop / October 11, 2026

The homepage is the interactive workshop. The default **Design an interior** mode is the custom fitting study; **Inspect native ships** retains the original three published layouts. `/ship-lab` is its stable sharing route. `/ship-design` remains the existing ship discussion feed. The game introduction lives at `/game`; explanatory system pages live under `/systems`, with the existing carrier and rescue guides under `/ships`.

## Data and code boundaries

- `scripts/render-lab.mjs` reads only the pinned, already-public KESTREL, KESTREL / PD and KESTREL / SIGNAL packets referenced by `content/fleet-register.json`. It emits `site/ship-lab-data.js` with machinery positions, ratings, dependencies, parts and art provenance. It never runs the engine, imports private files or changes published ship pointers.
- `site/ship-lab-model.js` is a pure evaluator: immutable definition + user state -> derived capability and individual blocker reasons. It has no DOM, network, clocks or persistence. Keep this seam if a native engine adapter is added later; do not make UI components own the simulation.
- `site/ship-lab.js` owns selection, projection, input and local persistence. Native image projections locate each core; callout tethers are selection aids, not physical pipes or cable routes. Actual damage geometry is not generated.
- `site/ship-lab.css` owns the responsive control surface. Selected components, status text, dependency buttons and the equipment list supplement color. The SVG markers accept Enter/Space.

## Current simulation contract

The dependency-first allocator and default kind/index priority follow the reviewed `FleetVoxelReactorPower.cpp` and `FleetVoxelMachinery.cpp` sources. Generator self-demand is paid first. Consumers require their dependencies, a live listed source, enough remaining watts, and nonempty linked fuel/ammunition. A failed request does not spend another consumer's watts. Player priority overrides are explicitly experimental, with recursive dependencies still paid first.

Reactor output is `rated * clamp((condition - .60) / .40, 0, 1)` at nominal temperature. This is the reviewed game's containment derating curve, not a claim that an October 6 packet contains every October 11 rule. Damage controls choose 0/25/50/75/100% directly. Nonreactor components remain usable above zero in this reduced model; main thrust additionally scales linearly with condition. Destruction or disabling blocks the exported dependency chain. Test fire spends one real exported magazine unit; emptying a store blocks its linked consumers. Reset is an explicit restoration of the scenario, not an in-game free repair or resupply.

Heat, cooling transients, voxel material loss, structural admission/separation, muzzle obstruction, crew, simulation time, movement, targeting, shield sectors and ongoing fuel use are outside this first model. Cooling manifolds record damage without inventing missing thermal links. The native inspection mode does not change geometry; the separate interior study below supports prototype placement. Neither mode imports or exports engine saves. Do not present this as engine parity or a combat test range.

## Persistence and sharing

Local storage is keyed by schema + exact native revision. A bounded URL fragment contains only the ship/revision, selected component and condition/enabled/priority/store state. Decode against an allowlisted ship/revision; validate every field and bound before evaluating. Invalid links open an intact local prototype. Fragments are not sent as HTTP paths or query parameters. No member identity, credential or comment goes into a setup. JSON export is labelled a UI prototype, not a game save.

No workshop action calls an API, writes D1 or starts a polling loop. Existing global identity/presence behavior remains separate. Sharing is manual; it never posts to Discord or the community on the user's behalf. The website community's existing link policy may limit pasted URLs; Discord is an available place to share a setup.

## Authoring and review

Run `node scripts/prepare-site.mjs` before committing; it generates all static pages, data, fingerprints and sitemap entries. Field guide copy is in `content/field-guide.json`, with authoring-only source references. Existing discussion routes and composer IDs must remain intact. Build/check locally and let Ryan judge the controls and their suitability for the game. No production test accounts/posts, schema changes, billing or infrastructure changes are needed for this feature.

## Custom interiors / October 11 follow-up

`content/workshop-outfit.json` owns a versioned catalog of equipment footprints, prices, the hull mask, service corridor and three starter recipes. `render-lab.mjs` emits `outfit-data.js`; `render-outfit.mjs` authors the UI. `outfit-model.js` validates immutable placements and adapts them to the same `FleetLabModel` used for native inspections. `outfit.js` owns only interaction, local persistence and sharing. No backend, clock, D1 writes or native source mutations.

The 16 by 8 plan has 102 usable design spaces after the reserved corridor. These are deliberately proposed design units, NOT native empty-voxel volume or a promise of real KESTREL fitting clearance. Command and distribution positions are fixed. Every optional module needs a contiguous, non-overlapping rectangular footprint within the hull mask; drives are restricted to the aft four columns. Move and rotate validate before replacing the old placement. Failed placement changes no equipment, space, stores or price. Damaged, empty and disabled hardware still occupies its full footprint and costs the same. Only removal releases space and purchase cost.

Native references retain Ember 60 kW generation/12 W self-demand, command 1,080 W, drives 22,020 W/24 MN, shields 6,025 W, kinetic battery 7,000 W, tanks 8,000 kg and magazines 60 rounds. Crew demand (5 kW), every footprint and all design-credit prices are provisional. The new jump package costs 650 design credits, occupies four spaces and requests 90 kW while the user selects charging mode. This intentionally tests Ryan's requested compact/high-demand/expensive jump tradeoff; it is not current native jump tuning. There is no charging time or jump execution. Normal operation reserves no jump-charging power. Low allocation blocks charging; high priority may displace propulsion, guns or shields.

Initial escort: 70/102 spaces, 2,200 design credits, 63,169 W continuous demand, 120,000 W healthy generation, 153,169 W with jump charging. Local defense removes the jump hardware: 66 spaces, 1,550 credits, no independent jump capability. Five-reactor study has 300 kW but uses 66 spaces including fixed command/distribution; it starts without drives, weapons or crew and says so. It is a deliberately incomplete layout. The default 2,500-credit target is editable and advisory; over-budget designs are clearly warned, never silently resized or given funds.

All custom equipment uses an abstract common bus and first usable fuel/ammo store. A missing, empty, disabled or destroyed store cannot supply its consumer. This is not real piping, routing, support, exterior mount clearance, mass balance, thermal, crew, endurance or handling admission. No hidden capacity is inferred from native artwork. The shared allocator still pays finite reactor output and dependencies, with explicit missing-store rejection added for removable hardware.

Custom recipes use `#fit=` (maximum 24,000 characters) and separate localStorage keyed to catalog version. Up to 48 unique, bounded installations are accepted; fixed installations, all state fields, footprints and overlaps are revalidated. Unknown versions fail safely. Original `#setup=` native links still open the native tab. No profile or secret is serialized. Export labels the receipt as a UI prototype. Bump the catalog version before changing a released envelope, footprint or stat contract; do not reinterpret old recipes silently.

Browser review is bounded; Ryan owns the next UI and balance decision. No native game harness, real campaign purchase, engine save or production social test is appropriate for this pass.

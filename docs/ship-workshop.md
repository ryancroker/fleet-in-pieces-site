# Ship workshop / October 11, 2026

The homepage is the interactive workshop. `/ship-lab` is its stable sharing route. `/ship-design` remains the existing ship discussion feed. The game introduction lives at `/game`; explanatory system pages live under `/systems`, with the existing carrier and rescue guides under `/ships`.

## Data and code boundaries

- `scripts/render-lab.mjs` reads only the pinned, already-public KESTREL, KESTREL / PD and KESTREL / SIGNAL packets referenced by `content/fleet-register.json`. It emits `site/ship-lab-data.js` with machinery positions, ratings, dependencies, parts and art provenance. It never runs the engine, imports private files or changes published ship pointers.
- `site/ship-lab-model.js` is a pure evaluator: immutable definition + user state -> derived capability and individual blocker reasons. It has no DOM, network, clocks or persistence. Keep this seam if a native engine adapter is added later; do not make UI components own the simulation.
- `site/ship-lab.js` owns selection, projection, input and local persistence. Native image projections locate each core; callout tethers are selection aids, not physical pipes or cable routes. Actual damage geometry is not generated.
- `site/ship-lab.css` owns the responsive control surface. Selected components, status text, dependency buttons and the equipment list supplement color. The SVG markers accept Enter/Space.

## Current simulation contract

The dependency-first allocator and default kind/index priority follow the reviewed `FleetVoxelReactorPower.cpp` and `FleetVoxelMachinery.cpp` sources. Generator self-demand is paid first. Consumers require their dependencies, a live listed source, enough remaining watts, and nonempty linked fuel/ammunition. A failed request does not spend another consumer's watts. Player priority overrides are explicitly experimental, with recursive dependencies still paid first.

Reactor output is `rated * clamp((condition - .60) / .40, 0, 1)` at nominal temperature. This is the reviewed game's containment derating curve, not a claim that an October 6 packet contains every October 11 rule. Damage controls choose 0/25/50/75/100% directly. Nonreactor components remain usable above zero in this reduced model; main thrust additionally scales linearly with condition. Destruction or disabling blocks the exported dependency chain. Test fire spends one real exported magazine unit; emptying a store blocks its linked consumers. Reset is an explicit restoration of the scenario, not an in-game free repair or resupply.

Heat, cooling transients, voxel material loss, structural admission/separation, muzzle obstruction, crew, simulation time, movement, targeting, shield sectors and ongoing fuel use are outside this first model. Cooling manifolds record damage without inventing missing thermal links. There is no fitting/placement editor and no engine-save import/export. Do not present this as engine parity or a combat test range.

## Persistence and sharing

Local storage is keyed by schema + exact native revision. A bounded URL fragment contains only the ship/revision, selected component and condition/enabled/priority/store state. Decode against an allowlisted ship/revision; validate every field and bound before evaluating. Invalid links open an intact local prototype. Fragments are not sent as HTTP paths or query parameters. No member identity, credential or comment goes into a setup. JSON export is labelled a UI prototype, not a game save.

No workshop action calls an API, writes D1 or starts a polling loop. Existing global identity/presence behavior remains separate. Sharing is manual; it never posts to Discord or the community on the user's behalf. The website community's existing link policy may limit pasted URLs; Discord is an available place to share a setup.

## Authoring and review

Run `node scripts/prepare-site.mjs` before committing; it generates all static pages, data, fingerprints and sitemap entries. Field guide copy is in `content/field-guide.json`, with authoring-only source references. Existing discussion routes and composer IDs must remain intact. Build/check locally and let Ryan judge the controls and their suitability for the game. No production test accounts/posts, schema changes, billing or infrastructure changes are needed for this feature.

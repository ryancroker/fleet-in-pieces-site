# Ship workshop / October 11, 2026

The homepage is the interactive workshop. The default **Outfit a ship** mode is the custom fitting study; **Inspect native ships** retains the original three published layouts. `/ship-lab` is its stable sharing route. `/ship-design` remains the existing ship discussion feed. The game introduction lives at `/game`; explanatory system pages live under `/systems`, with the existing carrier and rescue guides under `/ships`.

## Data and code boundaries

- `scripts/render-lab.mjs` reads only the pinned, already-public KESTREL, KESTREL / PD and KESTREL / SIGNAL packets referenced by `content/fleet-register.json`. It emits `site/ship-lab-data.js` with machinery positions, ratings, dependencies, parts and art provenance. It never runs the engine, imports private files or changes published ship pointers.
- `site/ship-lab-model.js` is a pure evaluator: immutable definition + user state -> derived capability and individual blocker reasons. It has no DOM, network, clocks or persistence. Keep this seam if a native engine adapter is added later; do not make UI components own the simulation.
- `site/ship-lab.js` owns selection, projection, input and local persistence. Native image projections locate each core; callout tethers are selection aids, not physical pipes or cable routes. Actual damage geometry is not generated.
- `site/ship-lab.css` owns the responsive control surface. Selected components, status text, dependency buttons and the equipment list supplement color. The SVG markers accept Enter/Space.

## Current simulation contract

The dependency-first allocator and default kind/index priority follow the reviewed `FleetVoxelReactorPower.cpp` and `FleetVoxelMachinery.cpp` sources. Generator self-demand is paid first. Consumers require their dependencies, a live listed source, enough remaining watts, and nonempty linked fuel/ammunition. A failed request does not spend another consumer's watts. Player priority overrides are explicitly experimental, with recursive dependencies still paid first.

Reactor output is `rated * clamp((condition - .60) / .40, 0, 1)` at nominal temperature. This is the reviewed game's containment derating curve, not a claim that an October 6 packet contains every October 11 rule. Damage controls choose 0/25/50/75/100% directly. Nonreactor components remain usable above zero in this reduced model; main thrust additionally scales linearly with condition. Destruction or disabling blocks the exported dependency chain. Test fire spends one real exported magazine unit; emptying a store blocks its linked consumers. Reset is an explicit restoration of the scenario, not an in-game free repair or resupply.

Heat, cooling transients, voxel material loss, structural admission/separation, muzzle obstruction, crew, simulation time, movement, targeting, shield sectors and ongoing fuel use are outside this first model. Cooling manifolds record damage without inventing missing thermal links. The native inspection mode does not change geometry; the separate equipment study below supports section assignments. Neither mode imports or exports engine saves. Do not present this as engine parity or a combat test range.

## Persistence and sharing

Local storage is keyed by schema + exact native revision. A bounded URL fragment contains only the ship/revision, selected component and condition/enabled/priority/store state. Decode against an allowlisted ship/revision; validate every field and bound before evaluating. Invalid links open an intact local prototype. Fragments are not sent as HTTP paths or query parameters. No member identity, credential or comment goes into a setup. JSON export is labelled a UI prototype, not a game save.

No workshop action calls an API, writes D1 or starts a polling loop. Existing global identity/presence behavior remains separate. Sharing is manual; it never posts to Discord or the community on the user's behalf. The website community's existing link policy may limit pasted URLs; Discord is an available place to share a setup.

## Authoring and review

Run `node scripts/prepare-site.mjs` before committing; it generates all static pages, data, fingerprints and sitemap entries. Field guide copy is in `content/field-guide.json`, with authoring-only source references. Existing discussion routes and composer IDs must remain intact. Build/check locally and let Ryan judge the controls and their suitability for the game. No production test accounts/posts, schema changes, billing or infrastructure changes are needed for this feature.

## Section outfitting / October 11 follow-up

Ryan rejected literal rectangular packing. The default mode now uses the original native KESTREL art and three approximate section markers: front, middle and rear. The equipment catalog lists Core / Compact / Medium / Large size classes, reserved space, design-credit price and off-to-operating power range. Reactors show a condition-dependent output range. The UI never claims continuous throttle control from those ranges.

`content/workshop-outfit.json` owns the `sections-2` schema. Front / middle / rear capacities are 30 / 40 / 32 design spaces. These are proposed budgets, not measured empty hull volume. Every instance has a UID, catalog type and section, plus separate working condition, enabled, priority and finite store state. Fixed bridge and bus remain front and middle; drives are rear-only. Adding or reassigning requires sufficient space. Damage, disabling or empty stores never refund space or purchase cost. Only removing hardware does.

`outfit-model.js` owns validation, capacity admission and adaptation to the shared pure evaluator. `outfit.js` owns selection, lists, art markers and local recipes. The existing native inspection mode, geometry, packets, #setup links and evaluator are unchanged. No game source, backend, D1, clock or polling is introduced.

Section damage removes 25 condition points from every assigned component. Repair restores condition only, not stores or enabled state. Individual controls, priority and test-fire are under Test this component. This is a damage-control interaction study, not a voxel impact, heat, structure or flight simulation. Markers identify approximate regions; fitting equipment does not change the picture or prove mount clearance.

Native reference ratings remain Ember 60kW / 12W self-demand, command 1,080W, drive 22,020W / 24MN, shield 6,025W, gun 7,000W, tank 8,000kg and magazine 60 rounds. Crew demand (5kW), size/space reservations, section capacities and all design-credit prices are proposed. The compact jump package uses four spaces, 650 design credits and 90kW while charging, deliberately exploring Ryan's requested tradeoff rather than current engine jump tuning.

Default escort: front18 / middle28 / rear24, total70/102, 2,200 credits, 63,169W normal demand, 120,000W generation, 153,169W charging demand. Local defense removes jump: 66 spaces / 1,550 credits. Five reactors use66 spaces including cores and supply300kW, with missing drives/crew/weapons called out. Build budget is advisory and overages visible; section admission is enforced.

All custom hardware connects through an abstract common bus and the first usable store. Dependencies, finite power and nonempty fuel/ammunition remain necessary. No pipe routing, exterior clearance, mass, thermal, crew endurance or engineering admission is claimed.

## Released recipe compatibility

New recipes use `fleet-outfit:sections-2` localStorage and bounded #fit fragments (24,000 characters, 48 unique installations, UID1–10000). Validate all fields and fixed cores before use. The old `fleet-interior:interior-1` key is read only when no new recipe exists; the old record is never rewritten. Old links are validated against their frozen grid bounds, corridor, footprints and drive limits before conversion. Fixed cores get the new fixed sections; other equipment maps by the old X footprint centre into three equal bands (low X = rear). Hardware, UIDs, conditions, priorities, stores, budget and power phase are preserved.

Conversion is explicitly disclosed. Section overages are retained as visibly invalid editable drafts; nothing is silently deleted or relocated to make a fit pass. New adds/moves still obey destination capacity. Unknown versions fail safely. Keep the frozen legacy metadata and bump the new version before changing its capacities or equipment ratings. Exports identify a UI prototype, never an engine save; no account or credential data is included.

Generation, syntax and bounded local browser checks precede normal GitHub deployment. Ryan owns usability and balance acceptance; do not expand this into a game test harness or production social tests.

## Section focus treatment

The custom workshop dims the native transparent artwork to22% opacity and reveals the selected front/middle/rear region with an SVG gradient mask along the projected fore/aft axis. The region boundaries are halfway between existing section markers, with a soft edge; this is approximate visual focus, not geometry segmentation. A restrained light edge and brighter active callout reinforce selection. Section buttons, markers and assignments all use the same selected-section state. No image bytes, recipe tuning, model, persistence or native inspection behavior changes.
# Visible fittings / sections-3 — October 11, 2026

The custom view now renders the pinned KESTREL mesh, not its flattened PNG. The
native builder was inspected first: `FOutfitSelection`, `BuildOutfit`,
`Customization::MixedGuns` and `Customization::Emitter` own the native articles.
`content/workshop-geometry/source.json` records the exact export and source hashes.
`scripts/build-workshop-geometry.py` converts the saved native PLY and translates
the alternate articles' box/taper/plane construction into bounded web geometry.
Run it explicitly with Python when changing geometry; generated binary and JS are
committed. `prepare-site.mjs` fingerprints the JS and links it into both routes.
No game or renderer process is launched. Stock surfaces retain native AO; new
articles use the native authored colors and the registrar's editorial lighting.

`outfit-renderer.js` uses one WebGL canvas and a depth buffer. It draws on recipe,
selection and size changes only, without an animation/poll loop. Original hull,
reactors and drives remain reference geometry. Only fitted weapons and emitters
are drawn from the custom recipe. Removing one exposes the underlying native
mount. Source-derived alternate articles are Standard/Rapid/Lance weapons and
Stock/Reservoir/Cascade/Facet emitters. Independent mounted articles replace each
other; there are no hidden stock guns under an overlay. Render failure is explicit
and does not substitute a misleading intact picture. This is a visual adapter,
not a port of native manufacturing, simulation or campaign admission. In
particular, it does not certify native combinations affected by the previously
reported native `barrel.forward.finish` construction issue.

There is one front weapon mount, one middle defensive weapon mount, and two
emitter mounts each in front and rear. Approximate section capacity and physical
mount count must both admit new additions/moves/swaps. Ordered installation UID
assigns articles to the available native mounts. Existing excess fits remain
editable drafts: every item, its condition, stores, space and price is retained,
but unmounted weapons/emitters are marked and cannot operate or consume power.
No automatic movement or discarding. Future explicit slot selection would need a
new versioned contract. Marker buttons and the adjacent list both select fittings;
empty mounts select the corresponding add control. New add/swap controls are in
the inspector. Swaps preserve condition, enabled state and power priority.

Released sections-2 item ratings/prices are retained. New prototype prices/space:
Rapid 180cr/6, Lance 240cr/8, Reservoir 160cr/6, Cascade 150cr/4, Facet 140cr/4.
Weapon draw follows native 1.10/1.20 multipliers. Emitter draw follows native
1.10/1.60/1.00 multipliers; reserve/recharge family multipliers are displayed,
not a time-stepped shield-combat simulation. Front/middle guns use the same
prototype package rating even though the native physical assemblies differ.

Storage is `fleet-outfit:sections-3`, falling back to `fleet-outfit:sections-2`,
then the frozen interior-1 converter. Prior keys remain intact. Old section links
accept only old type IDs before conversion; legacy grid links keep their frozen
validation. Native #setup links and Inspect native ships remain unchanged.

Bounded local 1440/390 review checked gun removal, add at the second mount,
Rapid/Lance swaps, emitter removal and Reservoir/Cascade changes, preserved damage,
sharing/restoration and no horizontal mobile overflow. Static generation, syntax
and narrow migration/admission checks passed. Ryan owns usability and visual
acceptance. No backend, D1, production QA records, infrastructure or game changes.

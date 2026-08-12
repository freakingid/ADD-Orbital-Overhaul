# IMPLEMENTATION PHASES — CS028

Companion to `PLANNED-FEATURES-CS028.md` — read that first, especially §4
(FORK-CS028-A), §6.2 (what CS027 changed) and §6.3 (the test obligation).

**Two phases, one gate.** There is **no P0** — CS027 P6 already archived its own
planning pair as part of the new closing ritual it built. Do not add one.

**Every anchor below is quoted by content, never by line number.** Re-grep each
quoted block before editing; if it doesn't match, stop and report the diff
rather than guessing. Line numbers in parentheses are as-of `a5ef9f4` and are
navigation hints only.

---

## Dependency graph

```
P1 (data + logic + test, one commit) ──▶ GATE (Paul, in browser) ──▶ P2 (closing)
```

---

## P1 — Data shape, identity propagation, split-site rewrite, and the test

**Model:** Opus, xhigh effort, with thinking. Put `ultrathink` in the session.
This phase changes a data shape three call sites depend on and resolves
FORK-CS028-A in code.

### Why this is one phase and not two

Splitting "new data" from "new logic" was considered and rejected. The old
`SAT_ART[i].small` field disappears in favour of `.pieces`, and the
constructor's `this.size === 1 ? artDef.small : artDef.full` branch throws the
moment `small` stops existing. Either ordering produces a broken intermediate
commit. They ship together.

### Step 1 — Replace `SAT_ART`, add `SAT_SCRAP`

Grep `const SAT_ART = [` (~4982). Replace the entire table end to end with the
block below, and add `SAT_SCRAP` as its own top-level `const` immediately
adjacent (either order; keep them together — the same constructor branch reads
both).

This block is generated directly from `tools/sat-art-lab.html`, the same tool
Paul reviewed the silhouettes in, and has been round-trip validated: 12 craft,
3 scrap sets, `pieces.length === 3` everywhere, every point inside the unit
circle. There should be nothing to eyeball beyond confirming the paste landed.

```js
// Generic scrap for the small tier (size 1). Craft-agnostic by design: at r=13
// no silhouette survives, so identity is deliberately abandoned here.
const SAT_SCRAP = [
  [ // bent panel shard
    { pts: [[-0.85,-0.3],[0.2,-0.45],[0.85,0.25],[-0.3,0.5]], closed: true },
    { pts: [[-0.32,-0.38],[0.1,0.4]], closed: false }
  ],
  [ // torn truss offcut
    { pts: [[-0.85,-0.22],[0.7,-0.3]], closed: false },
    { pts: [[-0.8,0.28],[0.85,0.2]], closed: false },
    { pts: [[-0.82,-0.22],[-0.3,0.26],[0.2,-0.26],[0.7,0.22]], closed: false }
  ],
  [ // hull plate + stub
    { pts: [[-0.7,-0.4],[0.3,-0.62],[0.8,0.1],[0.15,0.62],[-0.6,0.35]], closed: true },
    { pts: [[0.3,-0.62],[0.48,-0.8]], closed: false }
  ]
];

const SAT_ART = [
  { // 0 — Sputnik 1 (USSR, 1957): sphere + swept whiskers; one whisker snapped and kinked back
    full: [
      { pts: [[0.68,0],[0.6,0.18],[0.42,0.26],[0.24,0.18],[0.16,0],[0.24,-0.18],[0.42,-0.26],[0.6,-0.18]], closed: true },
      { pts: [[0.16,0],[0.68,0]], closed: false },
      { pts: [[0.28,-0.2],[-0.62,-0.56]], closed: false },
      { pts: [[0.28,0.2],[-0.62,0.56]], closed: false },
      { pts: [[0.2,-0.1],[-0.78,-0.24]], closed: false },
      { pts: [[0.2,0.1],[-0.3,0.3],[-0.38,0.52]], closed: false }
    ],
    pieces: [
      [ // 0 — pressure sphere
        { pts: [[0.55,0],[0.39,0.39],[0,0.55],[-0.39,0.39],[-0.55,0],[-0.39,-0.39],[0,-0.55],[0.39,-0.39]], closed: true },
        { pts: [[-0.55,0],[0.55,0]], closed: false },
        { pts: [[-0.39,-0.39],[-0.72,-0.62]], closed: false }
      ],
      [ // 1 — whisker pair on torn root
        { pts: [[0.3,0.1],[0.55,-0.15],[0.4,-0.4],[0.15,-0.2]], closed: true },
        { pts: [[0.2,-0.15],[-0.8,0.2]], closed: false },
        { pts: [[0.28,0.02],[-0.7,0.55]], closed: false }
      ],
      [ // 2 — hull shard + bent whisker
        { pts: [[0.5,-0.45],[0.1,-0.72],[-0.45,-0.48],[-0.58,0.05],[-0.15,0.3],[0.35,0.05]], closed: true },
        { pts: [[0.35,0.05],[0.65,0.45],[0.55,0.8]], closed: false }
      ]
    ]
  },
  { // 1 — Vanguard 1 (US Navy (NRL), 1958): sphere + radial spikes; one spike bent double
    full: [
      { pts: [[0.22,0],[0.156,0.156],[0,0.22],[-0.156,0.156],[-0.22,0],[-0.156,-0.156],[0,-0.22],[0.156,-0.156]], closed: true },
      { pts: [[-0.86,0],[0.86,0]], closed: false },
      { pts: [[0.43,0.74],[-0.43,-0.74]], closed: false },
      { pts: [[-0.11,0.19],[-0.43,0.74]], closed: false },
      { pts: [[0.11,-0.19],[0.34,-0.48],[0.6,-0.42]], closed: false }
    ],
    pieces: [
      [ // 0 — sphere + spike stubs
        { pts: [[0.42,0],[0.3,0.3],[0,0.42],[-0.3,0.3],[-0.42,0],[-0.3,-0.3],[0,-0.42],[0.3,-0.3]], closed: true },
        { pts: [[-0.85,0],[0.85,0]], closed: false },
        { pts: [[0.21,-0.36],[0.45,-0.78]], closed: false }
      ],
      [ // 1 — bent spike on hull frag
        { pts: [[-0.3,0.2],[0.05,-0.1],[-0.1,-0.45],[-0.5,-0.25]], closed: true },
        { pts: [[-0.1,-0.2],[0.35,0.2],[0.3,0.7]], closed: false },
        { pts: [[-0.35,-0.05],[-0.85,0.25]], closed: false }
      ],
      [ // 2 — crossed spike pair
        { pts: [[-0.8,-0.5],[0.8,0.5]], closed: false },
        { pts: [[-0.55,0.72],[0.45,-0.6]], closed: false },
        { pts: [[-0.12,-0.05],[0.1,-0.14],[0.18,0.06],[-0.04,0.15]], closed: true }
      ]
    ]
  },
  { // 2 — Explorer 1 (US Army / JPL, 1958): pencil cylinder + turnstile whips; one turnstile whip sheared to a stub
    full: [
      { pts: [[-0.82,-0.09],[0.62,-0.09],[0.86,0],[0.62,0.09],[-0.82,0.09]], closed: true },
      { pts: [[-0.4,-0.09],[-0.4,0.09]], closed: false },
      { pts: [[0.1,-0.09],[0.1,0.09]], closed: false },
      { pts: [[0,-0.09],[-0.5,-0.62]], closed: false },
      { pts: [[0,0.09],[-0.5,0.62]], closed: false },
      { pts: [[-0.2,-0.09],[-0.72,-0.4]], closed: false },
      { pts: [[-0.2,0.09],[-0.44,0.34]], closed: false }
    ],
    pieces: [
      [ // 0 — nose cone section
        { pts: [[-0.55,-0.22],[0.55,-0.1],[0.85,0],[0.55,0.1],[-0.55,0.22]], closed: true },
        { pts: [[-0.2,-0.17],[-0.2,0.17]], closed: false },
        { pts: [[-0.55,-0.22],[-0.68,-0.05],[-0.55,0.22]], closed: false }
      ],
      [ // 1 — mid tube + whip stubs
        { pts: [[-0.75,-0.16],[0.75,-0.16],[0.75,0.16],[-0.75,0.16]], closed: true },
        { pts: [[0.1,-0.16],[-0.35,-0.7]], closed: false },
        { pts: [[0.1,0.16],[-0.3,0.72]], closed: false }
      ],
      [ // 2 — aft tube, torn open
        { pts: [[-0.7,-0.18],[0.6,-0.14],[0.68,0.16],[-0.7,0.2]], closed: true },
        { pts: [[0.6,-0.14],[0.8,0.02],[0.68,0.16]], closed: false },
        { pts: [[-0.25,-0.19],[-0.25,0.19]], closed: false }
      ]
    ]
  },
  { // 3 — Telstar 1 (AT&T / Bell Labs, 1962): faceted geodesic sphere; upper-right facet peeled open
    full: [
      { pts: [[0.6,0],[0.52,0.3],[0.3,0.52],[0,0.6],[-0.3,0.52],[-0.52,0.3],[-0.6,0],[-0.52,-0.3],[-0.3,-0.52],[0,-0.6],[0.3,-0.52],[0.52,-0.3]], closed: true },
      { pts: [[-0.58,-0.12],[0.58,-0.12]], closed: false },
      { pts: [[-0.58,0.12],[0.58,0.12]], closed: false },
      { pts: [[-0.35,-0.12],[-0.35,0.12]], closed: false },
      { pts: [[0.35,-0.12],[0.35,0.12]], closed: false },
      { pts: [[-0.52,-0.3],[0.52,-0.3]], closed: false },
      { pts: [[-0.52,0.3],[0.52,0.3]], closed: false },
      { pts: [[0.3,-0.52],[0.46,-0.7],[0.58,-0.44]], closed: false }
    ],
    pieces: [
      [ // 0 — faceted hemisphere
        { pts: [[0.62,0],[0.54,-0.31],[0.31,-0.54],[0,-0.62],[-0.31,-0.54],[-0.54,-0.31],[-0.62,0]], closed: true },
        { pts: [[-0.54,-0.31],[0.54,-0.31]], closed: false },
        { pts: [[0,-0.62],[0,0]], closed: false }
      ],
      [ // 1 — equatorial antenna belt
        { pts: [[-0.85,-0.15],[0.85,-0.25],[0.85,0.2],[-0.85,0.3]], closed: true },
        { pts: [[-0.35,-0.19],[-0.35,0.26]], closed: false },
        { pts: [[0.3,-0.23],[0.3,0.22]], closed: false }
      ],
      [ // 2 — peeled facet panel
        { pts: [[-0.45,-0.55],[0.35,-0.65],[0.6,0.1],[-0.2,0.55],[-0.6,0.05]], closed: true },
        { pts: [[-0.02,-0.6],[-0.05,0.3]], closed: false }
      ]
    ]
  },
  { // 4 — Syncom / Early Bird (NASA / Hughes, 1964): spin-stabilised drum; drum wall stoved in on one side
    full: [
      { pts: [[-0.42,-0.26],[0.42,-0.26],[0.36,0.02],[0.42,0.26],[-0.42,0.26]], closed: true },
      { pts: [[-0.42,-0.26],[0,-0.36],[0.42,-0.26]], closed: false },
      { pts: [[-0.42,0.26],[0,0.36],[0.42,0.26]], closed: false },
      { pts: [[-0.2,-0.3],[-0.2,0.3]], closed: false },
      { pts: [[0.16,-0.3],[0.16,0.3]], closed: false },
      { pts: [[-0.16,0.34],[-0.26,0.62],[0.26,0.62],[0.16,0.34]], closed: false },
      { pts: [[0,-0.36],[0,-0.82]], closed: false },
      { pts: [[-0.14,-0.72],[0.14,-0.72]], closed: false }
    ],
    pieces: [
      [ // 0 — stoved-in drum
        { pts: [[-0.6,-0.38],[0.6,-0.38],[0.52,0.03],[0.6,0.38],[-0.6,0.38]], closed: true },
        { pts: [[-0.6,-0.38],[0,-0.52],[0.6,-0.38]], closed: false },
        { pts: [[-0.28,-0.42],[-0.28,0.42]], closed: false }
      ],
      [ // 1 — apogee nozzle cone
        { pts: [[-0.3,-0.6],[-0.58,0.58],[0.58,0.58],[0.3,-0.6]], closed: true },
        { pts: [[-0.38,-0.1],[0.38,-0.1]], closed: false }
      ],
      [ // 2 — antenna stalk + cap shard
        { pts: [[0.05,0.85],[-0.05,-0.6]], closed: false },
        { pts: [[-0.3,-0.42],[0.28,-0.48]], closed: false },
        { pts: [[-0.35,0.55],[0.3,0.62],[0.42,0.82],[-0.2,0.8]], closed: true }
      ]
    ]
  },
  { // 5 — Hubble Space Telescope (NASA / ESA, 1990): tube telescope + two wings; lower wing torn loose and skewed
    full: [
      { pts: [[-0.55,-0.28],[0.45,-0.28],[0.45,0.28],[-0.55,0.28]], closed: true },
      { pts: [[-0.2,-0.28],[-0.2,0.28]], closed: false },
      { pts: [[0.45,-0.28],[0.86,-0.38]], closed: false },
      { pts: [[0.45,-0.18],[0.84,-0.28]], closed: false },
      { pts: [[-0.34,-0.28],[-0.34,-0.8],[0.16,-0.8],[0.16,-0.28]], closed: true },
      { pts: [[-0.34,-0.54],[0.16,-0.54]], closed: false },
      { pts: [[-0.34,0.28],[-0.4,0.76],[0.06,0.86],[0.16,0.28]], closed: true },
      { pts: [[-0.37,0.52],[0.11,0.57]], closed: false }
    ],
    pieces: [
      [ // 0 — tube + aperture door
        { pts: [[-0.6,-0.34],[0.42,-0.34],[0.42,0.34],[-0.6,0.34]], closed: true },
        { pts: [[0.42,-0.34],[0.82,-0.45]], closed: false },
        { pts: [[0.42,-0.22],[0.8,-0.34]], closed: false },
        { pts: [[-0.2,-0.34],[-0.2,0.34]], closed: false }
      ],
      [ // 1 — intact solar wing
        { pts: [[-0.7,-0.45],[0.7,-0.45],[0.7,0.45],[-0.7,0.45]], closed: true },
        { pts: [[-0.7,0],[0.7,0]], closed: false },
        { pts: [[0,-0.45],[0,0.45]], closed: false }
      ],
      [ // 2 — torn wing + spar
        { pts: [[-0.65,-0.35],[0.55,-0.55],[0.72,0.3],[-0.45,0.55]], closed: true },
        { pts: [[-0.55,0.1],[0.62,-0.12]], closed: false },
        { pts: [[-0.65,-0.35],[-0.88,-0.25]], closed: false }
      ]
    ]
  },
  { // 6 — James Webb Space Telescope (NASA / ESA / CSA, 2021): hex mirror + kite sunshield; sunshield membrane ripped at the port tip
    full: [
      { pts: [[0,-0.2],[0.95,0.18],[0,0.62],[-0.95,0.18]], closed: true },
      { pts: [[0,-0.08],[0.72,0.2],[0,0.52],[-0.72,0.2]], closed: true },
      { pts: [[0.29,-0.63],[0,-0.8],[-0.29,-0.63],[-0.29,-0.29],[0,-0.12],[0.29,-0.29]], closed: true },
      { pts: [[-0.29,-0.63],[0.29,-0.29]], closed: false },
      { pts: [[0.29,-0.63],[-0.29,-0.29]], closed: false },
      { pts: [[0,-0.8],[0,-0.12]], closed: false },
      { pts: [[-0.22,-0.66],[0,-0.95]], closed: false },
      { pts: [[0.22,-0.66],[0,-0.95]], closed: false },
      { pts: [[-0.95,0.18],[-0.78,0.4],[-0.6,0.22]], closed: false }
    ],
    pieces: [
      [ // 0 — hex mirror cluster
        { pts: [[0.5,-0.29],[0,-0.58],[-0.5,-0.29],[-0.5,0.29],[0,0.58],[0.5,0.29]], closed: true },
        { pts: [[-0.5,-0.29],[0.5,0.29]], closed: false },
        { pts: [[0.5,-0.29],[-0.5,0.29]], closed: false },
        { pts: [[0,-0.58],[0,0.58]], closed: false }
      ],
      [ // 1 — torn sunshield corner
        { pts: [[-0.9,0.1],[0.2,-0.45],[0.75,0.2],[-0.3,0.62]], closed: true },
        { pts: [[-0.7,0.12],[0.15,-0.28],[0.58,0.2]], closed: false },
        { pts: [[-0.9,0.1],[-0.72,0.35],[-0.5,0.2]], closed: false }
      ],
      [ // 2 — tripod + loose segments
        { pts: [[-0.45,0.55],[0,-0.85],[0.45,0.55]], closed: false },
        { pts: [[0.18,0.3],[0.4,0.3],[0.51,0.49],[0.4,0.68],[0.18,0.68],[0.07,0.49]], closed: true },
        { pts: [[-0.55,0.15],[-0.33,0.15],[-0.22,0.34],[-0.33,0.53],[-0.55,0.53],[-0.66,0.34]], closed: true }
      ]
    ]
  },
  { // 7 — Voyager (NASA / JPL, 1977): dish + long lattice boom; magnetometer boom kinked at mid-span
    full: [
      { pts: [[-0.55,-0.3],[-0.4,-0.55],[0,-0.66],[0.4,-0.55],[0.55,-0.3]], closed: false },
      { pts: [[-0.55,-0.3],[0.55,-0.3]], closed: false },
      { pts: [[-0.2,-0.28],[0.2,-0.28],[0.26,-0.1],[0.14,0.06],[-0.14,0.06],[-0.26,-0.1]], closed: true },
      { pts: [[-0.2,0.02],[-0.52,0.14],[-0.7,0.44]], closed: false },
      { pts: [[-0.22,0.1],[-0.38,0.06],[-0.54,0.22],[-0.62,0.32]], closed: false },
      { pts: [[0.22,0.02],[0.62,0.24]], closed: false },
      { pts: [[0.58,0.14],[0.86,0.3],[0.78,0.46],[0.5,0.3]], closed: true },
      { pts: [[0.1,0.06],[0.44,0.7]], closed: false },
      { pts: [[-0.1,0.06],[-0.3,0.76]], closed: false }
    ],
    pieces: [
      [ // 0 — high-gain dish
        { pts: [[-0.8,0.3],[-0.58,-0.28],[0,-0.5],[0.58,-0.28],[0.8,0.3]], closed: false },
        { pts: [[-0.8,0.3],[0.8,0.3]], closed: false },
        { pts: [[-0.3,-0.12],[0,0.3],[0.3,-0.12]], closed: false }
      ],
      [ // 1 — RTG cluster on boom stub
        { pts: [[-0.85,-0.35],[-0.2,-0.05]], closed: false },
        { pts: [[-0.25,-0.3],[0.55,0.1],[0.35,0.5],[-0.45,0.1]], closed: true },
        { pts: [[-0.05,-0.1],[0.15,0.3]], closed: false }
      ],
      [ // 2 — kinked lattice boom
        { pts: [[-0.85,-0.3],[0.2,0.1],[0.75,0.55]], closed: false },
        { pts: [[-0.8,-0.05],[0.1,0.35],[0.6,0.75]], closed: false },
        { pts: [[-0.82,-0.28],[-0.45,0.1],[-0.1,-0.1],[0.15,0.32],[0.45,0.2],[0.68,0.6]], closed: false }
      ]
    ]
  },
  { // 8 — Pioneer 10 (NASA Ames / TRW, 1972): dish + hex bus + boom rtgs; port rtg boom snapped off short
    full: [
      { pts: [[0.52,-0.62],[0.28,-0.34],[0.2,0],[0.28,0.34],[0.52,0.62]], closed: false },
      { pts: [[-0.1,-0.28],[0.14,-0.28],[0.22,0],[0.14,0.28],[-0.1,0.28],[-0.18,0]], closed: true },
      { pts: [[0.52,-0.62],[0.86,0],[0.52,0.62]], closed: false },
      { pts: [[0.2,0],[0.86,0]], closed: false },
      { pts: [[-0.18,-0.12],[-0.66,-0.44]], closed: false },
      { pts: [[-0.6,-0.56],[-0.86,-0.4],[-0.78,-0.26],[-0.52,-0.42]], closed: true },
      { pts: [[-0.18,0.12],[-0.44,0.3],[-0.52,0.42]], closed: false },
      { pts: [[-0.1,0.28],[-0.3,0.78]], closed: false }
    ],
    pieces: [
      [ // 0 — dish + tripod feed
        { pts: [[0.1,-0.75],[-0.25,-0.4],[-0.35,0],[-0.25,0.4],[0.1,0.75]], closed: false },
        { pts: [[0.1,-0.75],[0.75,0],[0.1,0.75]], closed: false },
        { pts: [[-0.35,0],[0.75,0]], closed: false }
      ],
      [ // 1 — hex bus + boom stubs
        { pts: [[-0.25,-0.5],[0.3,-0.5],[0.55,0],[0.3,0.5],[-0.25,0.5],[-0.5,0]], closed: true },
        { pts: [[-0.5,-0.2],[-0.85,-0.4]], closed: false },
        { pts: [[-0.42,0.3],[-0.75,0.5]], closed: false }
      ],
      [ // 2 — RTG on bent arm
        { pts: [[-0.8,-0.45],[-0.25,-0.15],[0.05,-0.3]], closed: false },
        { pts: [[0,-0.45],[0.6,-0.1],[0.4,0.35],[-0.2,0]], closed: true },
        { pts: [[0.2,-0.28],[0.05,0.1]], closed: false }
      ]
    ]
  },
  { // 9 — Juno (NASA / JPL, 2011): three-bladed pinwheel; third blade folded back on its hinge
    full: [
      { pts: [[0.22,0],[0.11,0.19],[-0.11,0.19],[-0.22,0],[-0.11,-0.19],[0.11,-0.19]], closed: true },
      { pts: [[-0.13,-0.2],[-0.13,-0.92],[0.13,-0.92],[0.13,-0.2]], closed: true },
      { pts: [[-0.13,-0.56],[0.13,-0.56]], closed: false },
      { pts: [[0.125,0.223],[0.735,0.573],[0.865,0.347],[0.255,-0.003]], closed: true },
      { pts: [[0.43,0.4],[0.56,0.17]], closed: false },
      { pts: [[-0.125,0.223],[-0.44,0.33],[-0.62,0.52],[-0.78,0.34],[-0.57,0.1],[-0.255,-0.003]], closed: true }
    ],
    pieces: [
      [ // 0 — hex bus + blade roots
        { pts: [[0.45,0],[0.22,0.39],[-0.22,0.39],[-0.45,0],[-0.22,-0.39],[0.22,-0.39]], closed: true },
        { pts: [[-0.16,-0.4],[-0.16,-0.72],[0.16,-0.72],[0.16,-0.4]], closed: false },
        { pts: [[0.3,0.3],[0.62,0.55]], closed: false }
      ],
      [ // 1 — intact blade
        { pts: [[-0.2,-0.85],[0.2,-0.85],[0.2,0.85],[-0.2,0.85]], closed: true },
        { pts: [[-0.2,-0.28],[0.2,-0.28]], closed: false },
        { pts: [[-0.2,0.28],[0.2,0.28]], closed: false }
      ],
      [ // 2 — folded blade
        { pts: [[-0.18,-0.8],[0.22,-0.72],[0.4,0.2],[0.1,0.55],[-0.28,0.3]], closed: true },
        { pts: [[0.3,-0.28],[-0.22,-0.2]], closed: false },
        { pts: [[0.36,0.05],[-0.2,0.15]], closed: false }
      ]
    ]
  },
  { // 10 — Apollo Lunar Module (NASA / Grumman, 1969): spider-legged lander; starboard leg buckled, footpad gone
    full: [
      { pts: [[-0.34,-0.52],[0.34,-0.52],[0.4,-0.24],[0.22,-0.1],[-0.22,-0.1],[-0.4,-0.24]], closed: true },
      { pts: [[-0.26,-0.44],[-0.1,-0.44],[-0.14,-0.32]], closed: true },
      { pts: [[0.1,-0.44],[0.26,-0.44],[0.22,-0.32]], closed: true },
      { pts: [[-0.46,-0.1],[0.46,-0.1],[0.46,0.18],[-0.46,0.18]], closed: true },
      { pts: [[-0.12,0.18],[-0.18,0.36],[0.18,0.36],[0.12,0.18]], closed: false },
      { pts: [[-0.68,0.54],[-0.4,0.18],[0.4,0.18],[0.68,0.54]], closed: false },
      { pts: [[-0.34,0.6],[-0.2,0.18],[0.2,0.18],[0.3,0.48],[0.16,0.66]], closed: false },
      { pts: [[-0.78,0.56],[-0.58,0.56]], closed: false },
      { pts: [[0.58,0.56],[0.78,0.56]], closed: false },
      { pts: [[-0.44,0.62],[-0.24,0.62]], closed: false }
    ],
    pieces: [
      [ // 0 — ascent stage + windows
        { pts: [[-0.55,-0.42],[0.55,-0.42],[0.65,0.1],[0.35,0.42],[-0.35,0.42],[-0.65,0.1]], closed: true },
        { pts: [[-0.42,-0.28],[-0.15,-0.28],[-0.22,-0.05]], closed: true },
        { pts: [[0.15,-0.28],[0.42,-0.28],[0.35,-0.05]], closed: true }
      ],
      [ // 1 — descent stage + engine bell
        { pts: [[-0.75,-0.3],[0.75,-0.3],[0.75,0.2],[-0.75,0.2]], closed: true },
        { pts: [[-0.2,0.2],[-0.32,0.62],[0.32,0.62],[0.2,0.2]], closed: false },
        { pts: [[-0.25,-0.3],[-0.25,0.2]], closed: false }
      ],
      [ // 2 — leg pair + footpads
        { pts: [[-0.72,0.5],[-0.28,-0.35],[0.28,-0.35],[0.72,0.5]], closed: false },
        { pts: [[-0.84,0.52],[-0.6,0.52]], closed: false },
        { pts: [[0.6,0.52],[0.84,0.52]], closed: false }
      ]
    ]
  },
  { // 11 — Skylab (NASA, 1973): single-wing station + atm windmill; port wing ripped away at launch — stub only
    full: [
      { pts: [[-0.3,-0.26],[0.62,-0.26],[0.62,0.26],[-0.3,0.26]], closed: true },
      { pts: [[0.24,-0.26],[0.24,0.26]], closed: false },
      { pts: [[-0.1,-0.26],[-0.1,-0.86],[0.44,-0.86],[0.44,-0.26]], closed: true },
      { pts: [[-0.1,-0.56],[0.44,-0.56]], closed: false },
      { pts: [[-0.06,0.26],[-0.14,0.44],[0.1,0.4]], closed: false },
      { pts: [[-0.88,-0.42],[-0.32,0.42]], closed: false },
      { pts: [[-0.88,0.42],[-0.32,-0.42]], closed: false },
      { pts: [[-0.66,-0.1],[-0.54,-0.1],[-0.54,0.1],[-0.66,0.1]], closed: true }
    ],
    pieces: [
      [ // 0 — orbital workshop hull
        { pts: [[-0.8,-0.42],[0.8,-0.42],[0.8,0.42],[-0.8,0.42]], closed: true },
        { pts: [[-0.25,-0.42],[-0.25,0.42]], closed: false },
        { pts: [[0.3,-0.42],[0.3,0.42]], closed: false },
        { pts: [[0.8,-0.42],[0.92,-0.1],[0.8,0.42]], closed: false }
      ],
      [ // 1 — ATM windmill
        { pts: [[-0.8,-0.55],[0.8,0.55]], closed: false },
        { pts: [[-0.8,0.55],[0.8,-0.55]], closed: false },
        { pts: [[-0.18,-0.14],[0.18,-0.14],[0.18,0.14],[-0.18,0.14]], closed: true }
      ],
      [ // 2 — surviving solar wing
        { pts: [[-0.55,-0.75],[0.55,-0.75],[0.55,0.6],[-0.55,0.6]], closed: true },
        { pts: [[-0.55,-0.25],[0.55,-0.25]], closed: false },
        { pts: [[-0.55,0.2],[0.55,0.2]], closed: false },
        { pts: [[-0.55,0.6],[-0.25,0.78],[0.2,0.6]], closed: false }
      ]
    ]
  }
];
```

### Step 2 — Constructor: identity propagation

Find the signature (~5077):

```js
  constructor(x, y, size, speed = DEBRIS_SPEEDS[size]) {
```

Replace with:

```js
  constructor(x, y, size, speed = DEBRIS_SPEEDS[size], craft = null, piece = 0) {
```

Then find this block near the end of the constructor body (~5105–5117; grep the
distinctive comment text, not the line number):

```js
    // Authored satellite silhouette (v3.3 P2). Pick one archetype per instance (splits
    // re-roll independently), use the simplified `small` variant at the r=13 small tier,
    // then bake a per-instance copy scaled to `this.radius` with a small random per-vertex
    // jitter — the "wrecked/no two alike" look, applied ONCE here, never per frame. All the
    // draw path does is rotate this by this.angle; nothing anchors art to a fixed "up".
    const artDef = SAT_ART[Math.floor(rand(0, SAT_ART.length))];
    const polys = this.size === 1 ? artDef.small : artDef.full;
```

Replace those two `const` lines (keep everything from `const jit =` onward
exactly as it is) with:

```js
    // CS028 P1: satellites now carry identity ACROSS a split rather than re-rolling per
    // instance. A fresh spawn (size 3, craft unset) rolls a random craft exactly as before.
    // A split child (size 2) inherits the PARENT's craft from the split site and draws one
    // of that craft's three authored breakup pieces — piece 0 is the recognisable-core
    // convention (PLANNED-FEATURES-CS028.md §0.4). Size 1 drops craft identity BY DESIGN:
    // at r=13 with jitter no silhouette survives, so it draws from the shared,
    // craft-agnostic SAT_SCRAP pool instead.
    // `this.piece` is deliberately stored though the draw path never reads it — it is what
    // makes the "children get distinct pieces" invariant directly assertable in
    // test-cs028-p1.js. Two craft (Hubble, Skylab) have pieces whose polyline vertex-count
    // signatures collide, so inferring the piece from baked art geometry is NOT reliable.
    this.craft = craft !== null ? craft : Math.floor(rand(0, SAT_ART.length));
    this.piece = size === 2 ? piece % SAT_ART[this.craft].pieces.length : -1;
    let polys;
    if (this.size === 1) {
      polys = SAT_SCRAP[Math.floor(rand(0, SAT_SCRAP.length))];
    } else if (this.size === 2) {
      polys = SAT_ART[this.craft].pieces[this.piece];
    } else {
      polys = SAT_ART[this.craft].full;
    }
```

### Step 3 — Split site: FORK-CS028-A resolution

In `destroyDebris()` (~6149–6153), find:

```js
    const children = Math.round(lv.junkSplit);
    for (let i = 0; i < children; i++) {
      game.debris.push(new DebrisSatellite(a.x, a.y, a.size - 1, speed));
    }
```

Replace with:

```js
    const children = Math.round(lv.junkSplit);
    // CS028 P1 (FORK-CS028-A, PLANNED-FEATURES-CS028.md §4): a random per-kill offset rather
    // than a fixed index, so WHICH of the 3 authored pieces appear varies even while
    // junkSplit is 2 (levels 1-10). A fixed `i` would show pieces 0 and 1 forever and leave
    // piece 2 unseen for the first third of a typical run. Modulo (applied in the ctor)
    // keeps this safe if a debug override pushes junkSplit past 3.
    // ⚠ FLAGGED FOR THE GATE (§5 q1) — best guess, not a closed decision. If the gate prefers
    // piece 2 to read as a deliberate late-game reveal, P2 drops `pieceOffset +` and this
    // becomes `i`.
    const pieceOffset = Math.floor(rand(0, 3));
    for (let i = 0; i < children; i++) {
      game.debris.push(new DebrisSatellite(a.x, a.y, a.size - 1, speed, a.craft, pieceOffset + i));
    }
```

### Step 4 — Confirm the other two call sites need nothing

Grep `new DebrisSatellite(` and confirm **exactly three** matches:

1. Wave spawner, size 3 (~6001) — no `craft`/`piece` args, both default. **No change.**
2. The split site — edited in Step 3.
3. Title-screen decoration, size 3 (~9550) — same as #1. **No change.**

If a fourth call site exists, stop and report rather than assuming it's safe.

### Step 5 — Deliver `scratchpad/test-cs028-p1.js`

⛔ Required, per `CLAUDE.md`: *"A phase isn't done until its test passes."* Use
`scratchpad/_harness.js` (`buildGame`, `mkAssert`) — do not hand-roll a sandbox.
Seed first with `installSeed()` from `_seeded-random.js`, above everything.

⛔ **Assert only what this phase owns.** Do **not** assert registry size, lever
count, or any other global inventory — `test-registry.js` owns those alone.

Sections to cover:

- **(A) Shape.** `SAT_ART.length === 12`; every entry has `full` and `pieces`;
  every `pieces.length === 3`; `SAT_SCRAP.length === 3`; no entry retains a
  `small` field. Every point of every polyline satisfies `|p| <= 1`.
- **(B) Constructor dispatch.** Drive the real class. Size 3 → art matches the
  craft's `full` polyline count and `piece === -1`. Size 2 with explicit
  `craft`/`piece` → matches `pieces[piece]`. Size 1 → matches one of the
  `SAT_SCRAP` entries and `piece === -1`. Size 2 with `piece` ≥ 3 wraps by
  modulo (assert `piece === 4 % 3`).
- **(C) The split invariants — the heart of this phase.** Drive real
  `startGame()` then real `destroyDebris()` on a size-3 parent, repeated across
  many trials. Assert for every trial: every child inherits `parent.craft`;
  every child's `piece` is in `[0,3)`; and the children's `piece` values are all
  distinct (up to `min(children, 3)`). This has been pre-verified at 600/600 on
  a patched build, so a failure here is a real regression, not flakiness.
- **(D) Draw path unchanged.** `DEBRIS_RADII` still `{3:46, 2:26, 1:13}`;
  `drawPoly` / `glowStroke` signatures untouched.

Then: `node --check` the extracted script, and **run `node scratchpad/run-all.js`
before committing** — non-zero exit means not done. Expect 110/110 (109 at CS027
close, plus this file).

### Step 6 — Optional cosmetic cleanup

`tools/sat-art-lab.html` generates code-patch text still labelled `CS027`. Fix
by find-and-replace if convenient. **Art data is unaffected**; skip if it adds
any risk.

Suggested commit message:

```
cs-28 p1: satellite breakup model — 12-craft iconic art, craft/piece identity
across splits, generic small-tier scrap
```

---

## GATE — blocking, in-browser, not a Claude Code session

Four questions, in `PLANNED-FEATURES-CS028.md` §5. Answer with numbers or
decisions, not prose, where a fork or slider is involved:

1. FORK-CS028-A: rotate (shipped) or fixed index?
2. Jitter on Telstar / Webb at large tier: fine, or needs the per-polyline
   opt-out (FLAG-CS028-b)?
3. Piece distinctness — specifically Hubble pieces 1/2, Skylab pieces 0/2, Juno's
   folded blade. Readable as different objects, or convergent?
4. Spawn dilution at 12 craft vs. the old 6: richer, or recognition-diluting?

Record answers in `STATUS.md` under `## Playtest asks` before P2 runs.

---

## P2 — Closing phase

**Model:** Sonnet, medium effort — mechanical, *unless* gate question 2 or 3
comes back asking for art or jitter changes, in which case treat that as its own
edit first and consider Opus.

### Paste-ready prompt

```
Read STATUS.md's recorded CS028 gate answers first, then apply them.

CODE, only if the gate asked for it:
- FORK-CS028-A answered "fixed index": in destroyDebris()'s split loop, replace
  `pieceOffset + i` with `i` and delete the `pieceOffset` line. Update the
  comment above it so it no longer describes a rotation that isn't there.
- Jitter (FLAG-CS028-b) flagged as a problem: add a per-polyline
  `jitter: false` opt-out, honoured in the constructor's art-bake step. Read the
  gate's specific complaint before deciding which polylines get the flag — it is
  likely only Telstar's facet/belt lines and Webb's mirror-seam and
  sunshield-layer lines, not every polyline in those two entries.
- Piece distinctness (q3) flagged: this may mean real art rework. If so, STOP and
  surface it — new silhouette authoring is a design decision, not a closing-phase
  edit, and belongs in its own changeset.
- Question 4 is a read-only signal. No code change unless explicitly asked.

If code changed, update scratchpad/test-cs028-p1.js to match and re-run
`node scratchpad/run-all.js` — it must stay green.

THEN THE CLOSE-OUT RITUAL (CS027 P6 built this; follow log/CS027.md's example):
1. Re-grep GAME_VERSION rather than trusting this doc. It was "1.0.0.27" at
   CS028's start. Bump the patch number by one → "1.0.0.28".
2. GDD sweep: ORBITAL-OVERHAUL-GDD.md §2 is SHIPPED BEHAVIOUR ONLY. Add the
   twelve-craft breakup model now that it is shipped and gated. Do NOT document
   FLAG-CS028-b's opt-out unless the gate actually required it.
3. Append CS028's version-history entry to log/CS028.md under
   `## GDD version history`. There is NO central changelog and no
   GDD-VERSION-HISTORY.md — it was folded in CS027 P4.
4. Move the CS028 STATUS.md narrative into log/CS028.md, then reset STATUS.md
   from the template in CLAUDE.md's "STATUS.md format" section. Header line:
   Version 1.0.0.28 · Changeset CS028 (closed) · Registry 85 · Levers 18.
5. git mv PLANNED-FEATURES-CS028.md IMPLEMENTATION-PHASES-CS028.md archive/,
   preserving filenames, then grep -rn for bare-filename references to either
   and repoint them to archive/<name>.md. Leave STATUS.md/log historical prose
   mentions unedited — they are a record, not a live pointer.
6. Confirm registry is still 85 and LEVERS still 18. If either moved, something
   in CS028 was out of scope — stop and report rather than updating the number.
7. Commit.

Suggested commit message:
"cs-28 p2: closing phase — gate answers applied, version 1.0.0.28, doc sweep"
```

---

## Corrections

- **No P0.** The first draft of this file opened with a P0 that archived the
  CS027 planning pair. CS027 P6 already did that itself under the new close-out
  ritual it built. The phase was deleted, not renumbered.
- **The closing phase was rewritten wholesale.** The first draft told P2 to
  maintain a rolling three-changeset `STATUS.md` window and to append to
  `GDD-VERSION-HISTORY.md`. Both rituals were replaced in CS027 P4/P6 —
  `STATUS.md` is now one page reset from a template each changeset, and version
  history is per-changeset in `log/CS0##.md`.
- **A test is now mandatory.** The first draft said no formal test file was
  required for P1. `CLAUDE.md`'s test rules make that a direct violation:
  *"A phase isn't done until its test passes. Deliver the test with the code."*
  Step 5 exists because of that.
- **`this.piece` was added to the constructor after the fact.** It is not needed
  to draw anything. It was added because verifying the split invariant against
  the real `destroyDebris()` path showed that inferring a child's piece from its
  baked art is unreliable — Hubble's and Skylab's pieces collide on polyline
  vertex-count signature, which produced a false 374/400 before the field
  existed and a true 600/600 after.
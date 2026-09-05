# Design System — MTU King & Queen 2026

Source of truth for every visual decision in this app. Read this before touching
UI. Do not deviate without explicit approval.

## Product Context

- **What this is:** Awards voting for the Myanmar Technological University fresher
  welcome. Six categories, one ballot each, an admin console driving the election,
  and a live winner reveal.
- **Who it's for:** ~300 students on phones, a handful of teachers and judges, and
  two or three organisers running the night from a laptop.
- **Space:** Single-event university election. Peers are event apps and awards
  shows, not enterprise SaaS.
- **Project type:** Mobile-first web app with a projected reveal screen and an
  admin dashboard.
- **The memorable thing:** It should feel like an awards ceremony, not a form.
  Gold on near-black, Playfair on the headings, a crown that floats. Every
  decision below serves that.

## Aesthetic Direction

- **Direction:** Ceremonial / awards-night. Gold-leaf on midnight.
- **Decoration level:** Intentional. Shimmer on the title, a floating crest,
  a gold pulse on live state. Nothing else earns ornament.
- **Mood:** Formal enough that winning it means something; warm enough that a
  first-year feels invited.
- **Restraint rule:** Gold is the ceremony. Spend it on the crown, the primary
  action, and vote weight. Everywhere else, let the night ground carry the page.

## Typography

- **Display/Hero:** Playfair Display — 400/600/700 + italic. Awards-programme
  serif. Category names, page titles, the winner's name.
- **Body:** DM Sans — 300/400/500/600. Optical-size axis 9..40.
- **UI/Labels:** DM Sans, same as body.
- **Data/Tables:** JetBrains Mono — 400/500/700. Tallies, weights, roll numbers,
  request codes, percentages.
- **Code:** JetBrains Mono.
- **Loading:** One Google Fonts import at the top of `src/index.css`. Fallbacks
  declared: `Georgia, serif` / `system-ui, sans-serif` / `monospace`.
- **Tabular figures:** Any column of digits sets `font-variant-numeric: tabular-nums`.
  Vote totals, weights and percentages must align down a column.

## Color

- **Approach:** Restrained. One ceremonial accent (gold), one authority accent
  (royal), two semantic colours (jade, blush), six category hues, a night scale.

### Core

| Token | Hex | Role |
|---|---|---|
| `--color-night-950` | `#0D0D1A` | Page ground, dark |
| `--color-night-900` | `#161624` | Card surface, dark |
| `--color-night-800` | `#1E1E30` | Raised surface |
| `--color-night-700` | `#252538` | Track / divider |
| `--color-gold-500` | `#D4AF37` | Ceremony, primary action, **vote weight** |
| `--color-gold-400` | `#E8C84A` | Gradient partner, weight-chip text |
| `--color-gold-300` | `#F5D97A` | Shimmer highlight |
| `--color-jade-500` | `#00C9A7` | Verified identity, approval granted |
| `--color-blush-500` | `#FF4D8D` | Errors, declined requests |
| `--color-royal-500` | `#3B82F6` | **Judge identity, pending state** |
| `--color-royal-400` | `#60A5FA` | Judge text on night grounds |
| `--color-royal-600` | `#2563C4` | Judge text on cream grounds *(new)* |
| `--color-cream-50` | `#F8F5EF` | Page ground, light |
| `--color-cream-100` | `#F0EDE8` | Input / track, light |

### The two-signal rule

**Royal answers *who*. Gold answers *how much*.** A judge's identity is blue; the
weight their ballot carries is gold. Never merge them — if judges wore gold, a
judge badge and a `5×` chip would say the same thing as the crown behind them,
and weight would lose its own signature.

Royal is the only unused reserved token in the theme, which is why it was
available. Gold with deep blue is the university-regalia pairing: it reads as
institutional authority beside gold's ceremony rather than competing with it.

### Category hues

Defined once in `CATEGORY_META` (`src/types.ts`). That map is canonical.
Any other colour map for categories is a bug.

King `#E5B93F` · Queen `#FF7AAE` · Best Style `#A78BFA` ·
Smartest `#2EDBB8` · Mr.Popular `#E91111` · Miss Popular `#C93FC9`

### Dark mode

Both themes are first-class. Surfaces are redesigned, not inverted: night-950/900
in dark, cream-50/white in light. Gold holds on both; royal drops to `royal-600`
on cream for contrast.

## Spacing

- **Base unit:** 4px.
- **Density:** Comfortable. Cards breathe; a ballot is not a spreadsheet.
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)

## Layout

- **Approach:** Grid-disciplined for the app, generous single-column for auth.
- **Auth card:** `max-w-sm`, `rounded-3xl`, `p-7`. Must survive a 320px viewport.
- **Max content width:** `max-w-6xl` for admin and results.
- **Border radius:** sm 8px (chips) · md 12px (inputs, buttons) · lg 16–20px
  (inner cards) · 3xl 24px (auth card) · full 9999px (pills, tracks, badges).
- **Pill toggles carry at most two items.** Three pills in a 320px card leave
  ~77px each and the labels wrap. If a third role is needed, branch after
  sign-in instead of adding a pill.

## Motion

- **Approach:** Intentional. Motion marks state changes and live-ness, nothing else.
- **Existing keyframes:** `shimmer` 3s linear (title), `float` 3s ease-in-out
  (crest), `pulse-gold` 2s ease-in-out (live state).
- **Pending pulse:** reuses the `pulse-gold` shape in royal, 2.1s ease-out.
- **Spinner vs pulse:** a spinner claims the app is busy. When the app is waiting
  on a *person*, pulse instead.
- **Duration:** micro 50–100ms · short 150–250ms · medium 250–400ms · long 400–700ms.
- **Easing:** enter `ease-out` · exit `ease-in` · move `ease-in-out`.
- All decorative motion stops under `prefers-reduced-motion: reduce`.

---

## Feature spec — Teacher / Judge ballots

Full visual spec:
https://claude.ai/code/artifact/486f4fd3-4529-4e64-8723-b112782b3734

### Sign-in

Nobody is pre-registered. Any Google account may request judge access; the
request grants nothing until an organiser approves it.

1. **Two pills** — `🗳️ Vote` / `🛡️ Admin`, then the Google button. The pill
   row stays at two items so nothing wraps on a 320px phone. ("Student" becomes
   "Vote" — students are no longer the only people using that door.)
2. **Role branch, after Google** — two full-width cards: *Student* (confirm your
   roll number and vote right away) and *Teacher or judge* (an organiser approves
   you before you can vote). The judge card states the wait before it is entered.
3. **Name** — mirrors the student roll-number step. Plus an optional
   *department or role* line: a name alone is a guess for whoever is at the
   laptop; "Daw Khin Myo Myint · CEIT, Head of Department" is a recognition.
4. **Pending** — royal card, pulsing dot, name, email, and a mono request code
   (`J-07`) set at 25px so an organiser can read it across a table.

### Pending states

| State | Colour | Behaviour |
|---|---|---|
| Waiting | royal-500 | Polls. Elapsed timer appears after 60s so a forgotten judge escalates themselves. |
| Approved | jade-500 | Shows the multiplier, advances into the ballot on its own. No button to find. |
| Declined | blush-500 | Plain, non-blaming. Offers "Vote as a student instead". Never a dead end. |

### Admin

- **Seventh tab, "Judges"**, with a royal count badge.
- **Global banner** under the tab strip whenever the queue is non-empty, visible
  from every tab. On a live night the organiser is on *Ballots* watching turnout,
  and that is exactly when a teacher is standing at the desk.
- **Queue cards**, not table rows — approval is a decision and needs room.
- **Roster table** below: name, email, weight, ballots cast, contributed, revoke.

### Rules

1. **Approve and weight are one action.** Approve is disabled until a multiplier
   is chosen, and the button reads back the choice — *Approve at 5×*. No judge
   can exist at an undefined weight.
2. **Weight is stamped on the ballot at cast time.** Changing a multiplier later
   affects only ballots cast afterwards. The ledger stays immutable, matching the
   audit log's posture, and a weight change can never silently rewrite a result
   that has been announced.
3. **Approvals and declines land in the audit log** — who, at what weight, when.
   This is the one action that hands a person more power than everyone else, so
   it is the one that most needs a record.
4. **Weight renders as `5×`.** JetBrains Mono, gold, real multiplication sign
   (U+00D7), tabular figures. Never `x5`, never `500%`.
5. **The results breakdown is never behind a hover or a toggle.** Printed under
   every bar, on every candidate, always. A projector has no cursor, and a
   disclosure a student has to find is one they will say was hidden.
6. **A judge sees their multiplier before voting, not after.** The badge sits on
   the ballot header the whole time they choose.

### Results — the two-tone track

`Results.tsx:304` currently draws one bar in the category colour. Split it:
student ballots in the category colour, judge weight in royal, in one 9px
`rounded-full` track. The judge segment is omitted entirely at zero.

An upset then explains itself. A candidate with 268 student votes beating one
with 284 shows a visible blue tail while the runner-up's track is solid category
colour — legible from the back of the hall, with no number read. The arithmetic
stops being a footnote under the winner and becomes the winner.

Legend appears once per category header. Breakdown line under each bar:
`268 students · ⚖️ 5 judges +26`.

---

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-05 | Design system recorded from the existing implementation | The identity was already coherent in code but undocumented. Codified rather than redesigned. |
| 2026-09-05 | Royal `#3B82F6` promoted to judge identity | Only reserved token in the theme with no semantic role. Gold, jade and blush were all taken. Gold-with-blue is the regalia pairing. |
| 2026-09-05 | `Admin.tsx:21` `king: '#60A5FA'` → `#E5B93F` | Contradicted `CATEGORY_META.king` in `types.ts`. Admin painted King blue while the rest of the app painted it gold. Correction also releases royal. |
| 2026-09-05 | Role chosen after Google, not via a third pill | Three pills leave ~77px each at 320px and wrap. The branch screen also has room to warn a judge that approval is coming. |
| 2026-09-05 | Pending screen polls and auto-advances | Live event. A dead-end wait means judges silently never vote and it is discovered after the reveal. |
| 2026-09-05 | Results bar split two-tone | User chose to show raw and weighted both. Showing it in the bar rather than only in numbers makes an upset self-explaining on a projector. |
| 2026-09-05 | Weight snapshot on ballot at cast time | Prevents a later weight edit from rewriting an announced result. |

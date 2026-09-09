# Orbital Overhaul — 1.0.0.42

The big ones this round: the game tells you what's happening out loud, towing a full chain
finally feels heavy, and the Scoop is worth chasing further and easier to lose.

---

## Everything important makes a sound now

Twelve new sound effects, one per event that previously only your engineer's voice announced.
Your chain filling up, your payload being cut loose, the tow line severing, the Chain Guard
absorbing a hit, reaching a new level, your hull hitting critical and recovering, picking up a
powerup and losing one, the size of a delivery, and the Super Mega Delivery.

**These play whether or not you hear the voice.** With voice turned down, turned off, or simply
busy saying something else, the game no longer goes silent on you.

The Chain Guard also stops borrowing the shield's chirp. Guarding a hit and shielding a hit are
now two clearly different sounds, which they should always have been.

## Level ends and game overs fade

Both sequences used to hard-cut between every beat. The level-complete announcement, the
achievement panel, the next-level banner and the game-over table now cross-fade into each other.
Nothing takes longer than it used to — the pacing is identical, it just stops snapping.

## Towing feels like towing

A loaded tow chain now has real inertia rather than just a lower ceiling.

- **A full haul coasts for a long time.** Where a loaded ship used to slow down exactly as fast as
  an empty one, a 24-piece chain now takes roughly three times as long to bleed off speed. Plan
  your stops.
- **And it turns like it's heavy** — a full chain swings around at well under half the rate of an
  empty ship.
- **Cargo no longer caps your top speed.** A full haul can eventually reach the same top speed as
  an empty ship. It takes a while to get there, and much longer to shed. Mass costs you agility,
  not speed.
- **Acceleration with cargo is unchanged**, so a short chain still gets moving the way you're used
  to.

**The Engine powerup lasts far longer.** Its tank only drains while you're actually towing
something. Flying around empty used to quietly burn the whole thing on an effect that did nothing.

## The Scoop, rebuilt on both sides

**More to gain:**

- **Level 1 is about three times bigger.** The first Scoop pickup used to sit almost entirely
  inside your normal pickup radius and change nearly nothing. Now you can tell you got it.
- **Two new levels.** Levels 6 and 7 add capture orbs flanking the ship — the Scoop's first
  sideways reach, so a top-level Scoop is a different capability rather than just a wider cone.
- The Scoop meter on the HUD now shows all seven levels.

**More to lose:**

- **Every two hits costs a Scoop level**, down from five. A high Scoop used to survive almost any
  run you could live through; now you notice it going.
- **A banked Health charge can save it.** If your hull is still in decent shape when you take a
  hit, a spare Health charge will spend itself protecting a Scoop level instead of healing you.
  You'll see `SCOOP SAVED` where you'd normally see `SCOOP -1`. It does one or the other, never
  both.

**And it looks like what it is.** The Scoop's mouth and orbs are drawn as a dashed energy field
now, not a solid outline. They were reading as ship parts you could get hit on — they never were,
and now they don't look like it.

## Health shows up on a fairer schedule

- **Never more than one Health pickup on the field at a time**, from any source.
- **Score milestones only bring Health when you're actually hurt.** A milestone crossed at near
  full hull no longer spends itself on a scratch.
- **Milestones spread out as you go deeper**, instead of arriving faster and faster as your score
  rate climbs.
- Hurt players still see ambient Health roughly three times as often as healthy ones — that
  balance is unchanged, there's just less of it overall.

## Menus scroll when you hold a direction

Hold up or down to move through a menu instead of tapping once per row. Left/right, confirm and
back still take one press each, so sliders and toggles can't run away from you.

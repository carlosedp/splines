---
title: fx mod
summary: Add effects like reverb, delay, saturation and more to any SuperCollider script or nb voice. How the fx mod works, which effects exist, and how to wire them up.
topic: mods
authors:
  - carlosedp
checked: 2026-11-11
scripts:
  - fx
  - fx_tanh
  - fx_distortion
  - fx_bitcrusher
  - fx_delay
  - fx_rele
  - fx_pete
  - fx_llll
  - fx_dverb
  - fx_reflex
  - fx_koro
  - fx_filter
  - fx_comb
  - fixed-filter-banking-crisis
  - fx_resonator
  - fx_grains
  - fx_miUGens
  - fx_delayyy
  - fx_shimmer
  - fx_spring
  - preFX
  - emplaitress
  - doubledecker
tags:
  - fx
sources:
  - https://llllllll.co/t/fx-mod/62726
  - https://github.com/sixolet/fx
  - https://github.com/sonocircuit/fx
  - https://llllllll.co/t/prefx/75016
---

The [[fx]] mod adds **send** and **insert** effects to norns: reverb, delay,
saturation, filters, granular textures, on top of whatever script you're
playing. It works with SuperCollider engines and nb voices.

On its own, fx does nothing you can hear. It's a framework: the sounds come from
separate **effect mods** (fx_tanh, fx_dverb, fx_rele, ...) that plug into it. You
install fx once, then add the effects you want.

**In this guide:**

- what you need to know first, and which fx to install,
- a five-minute walkthrough to hear your first effect,
- how fx fits into the norns audio path, and what _insert_ and _send_ mean,
- recipes for common setups (reverb, delay into reverb, effects on the input),
- every known effect, grouped by what it does,
- troubleshooting, and two sections for script and effect developers.

## Before you start

A few words that come up all the time:

| term         | meaning                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **mod**      | an extension to norns itself, not a script. You turn it on in **SYSTEM → MODS** and it applies to every script you load.               |
| **engine**   | the SuperCollider synth a script uses to make sound. Most synth scripts have one.                                                      |
| **softcut**  | norns' built-in sampler/looper. It's separate from SuperCollider, which matters here (see [what works](#what-works-and-what-doesn-t)). |
| **nb voice** | a voice from the [nb]({{base}}/guides/nb/) ("n.b. et al.") system: a synth any nb-aware script can play. Many are mods too.            |
| **insert**   | an effect that processes _everything_ coming out of SuperCollider, in place. It has a dry/wet mix.                                     |
| **send**     | an effect that only hears what a voice _sends_ to it, and adds its fully wet output back to the mix.                                   |

You'll need norns with maiden open in a browser
([getting started]({{base}}/guides/getting-started/) walks through it if you haven't done that before).

## Which fx to install

There are two versions of the fx framework. Both install into the folder `fx`,
so you can only have one at a time:

- **[sixolet/fx](https://github.com/sixolet/fx)**, the original. This is what
  the [[fx]] page installs.
- **[sonocircuit/fx](https://github.com/sonocircuit/fx)**, sonoCircuit's fork.
  It fixes the audio input randomly leaking into the sends, rebuilds the effects
  at every script load so they always come last, and lets several inserts be
  **chained**, each with its own dry/wet. We recommend this version for most users.
  Get it from [the splines fork page]({{base}}/scripts/fx/forks/sonocircuit/fx/) until these changes
  are merged into sixolet/fx.

**This guide describes the fork**, and it's the one to pick unless you have a
reason not to. Where the original behaves differently, it says so. The full list
of changes is [at the end](#what-sonocircuit-s-fork-changes).

To switch from the original to the fork, delete `dust/code/fx` first. Effect
mods look for a folder named `fx`, so keep that name.

## Your first effect in five minutes

We'll add a saturator to _awake_. Both are the simplest of their kind:
[[fx_tanh]] has one parameter, and [[awake]] ships with norns and uses a
SuperCollider engine.

1. **Install the framework and the effect.** In maiden's REPL (the `>>` prompt):

   ```
   ;install https://github.com/sonocircuit/fx
   ;install https://github.com/sixolet/fx_tanh
   ```

2. **Turn both on.** On norns, go to **SYSTEM → MODS**. Select `fx` with E2 and
   turn E3 until it shows a **+**. Do the same for `fx_tanh`.
3. **Restart.** **SYSTEM → RESTART**, or `;restart` in maiden. Mods only load at
   startup.
4. **Load awake** and let it play.
5. **Find the effect.** Open **PARAMETERS → EDIT** and scroll down to the `fx`
   section, then to **fx tanh**.
6. **Switch it on.** Set its **slot** to `insert`. A **dry/wet** param appears,
   shown as a ratio like `50/50`.
7. **Turn up the gain** and listen to awake get warmer, then crunchier. Set the
   slot back to `none` to compare.

That's the whole workflow: install an effect mod, enable it, restart, then pick
a slot in the params of whatever script you're playing. Every effect works this
way and has its own `slot` param, so you can run several at once.

> **Every effect mod needs the fx mod and it's installed once.** Effects are
> built on a class defined in fx. Without it, SuperCollider fails to compile
> and norns shows _SUPERCOLLIDER FAIL_.

## Where fx sits in the audio path

**Effects run _after_ the engine.** At each script load, fx puts its group at
the very end of SuperCollider's node tree, so every synth before it has already
written its audio when the effects run.

Inside the fx group, **send effects run first, then inserts**. Inserts therefore
also process what the send effects return.

```
SuperCollider (runs top to bottom)
┌────────────────────────────────────────────────────────────────────┐
│ input group     ADC → context.in_b          (preFX mod lives here) │
│ engine group    engine synths / nb voices ──┬──► main out bus 0/1  │
│                                             ├──► ~sendA            │
│                                             └──► ~sendB            │
│ ── fx group (always last) ──────────────────────────────────────── │
│   send group    effects in "send a" read ~sendA ─┐                 │
│                 effects in "send b" read ~sendB ─┴► ADD to out 0/1 │
│   insert group  insert fx #1 → dry/wet → insert fx #2 → dry/wet…   │
│                 (each one reads and REPLACES out 0/1)              │
└───────────────────────────────────┬────────────────────────────────┘
                                    ▼
crone mixer:  ENGINE level ─► main mix, softcut input, system reverb/comp
              MONITOR (dry ADC)  ─► main mix     ← never goes through SuperCollider's fx
              SOFTCUT            ─► main mix     ← comes after SuperCollider; not processed
```

So the full chain is:

**engine → (+ send returns) → insert 1 → insert 2 → … → norns ENGINE level → crone mixer (reverb, compressor, softcut, output)**

The built-in reverb and compressor (PARAMETERS → REVERB / COMPRESSOR) belong to
crone, norns' mixer, not to SuperCollider. They always come after everything fx
does.

## Slots: insert, send a, send b

| slot     | reads from                   | writes to                               | dry/wet | several effects in this slot                       |
| -------- | ---------------------------- | --------------------------------------- | ------- | -------------------------------------------------- |
| `none`   | —                            | —                                       | —       | —                                                  |
| `send a` | `~sendA` bus                 | adds 100% wet signal to main out        | no      | run **in parallel**                                |
| `send b` | `~sendB` bus                 | adds 100% wet signal to main out        | no      | run **in parallel**                                |
| `insert` | main out (everything so far) | replaces main out, mixed by its dry/wet | yes     | run **in series**, in the order you turned them on |

**Which one?** Use **insert** when you want to change the whole sound of a
script; it works with any engine. Use a **send** when you want some voices wet
and others dry, or one shared reverb that each voice feeds by a different
amount. Sends only work with scripts that support them.

### Chaining inserts

Each effect you set to `insert` goes **to the end** of the insert chain. Each
one processes the output of the one before, with its own dry/wet.

- **The order is the order you turned them on.** To put the delay before the
  saturator, set the delay to `insert` first, then the saturator.
- **To reorder,** set the effect you want last to `none`, then back to `insert`.
  It moves to the end of the chain.

Under the hood, each insert gets a small _replacer_ synth that mixes the effect
back into the main bus at its dry/wet, then clears the shared wet bus so the next
effect starts clean.

### Sends

A send effect hears only what a voice writes to its send bus. Its output is
always 100% wet and is _added_ to the main mix. If nothing writes to `~sendA` or
`~sendB`, an effect in that slot is silent.

Several effects in the same send all get the same input and mix in parallel,
so their order doesn't matter.

## Send levels

**The fx mod has no send-level params.** The _sound source_ sets how much it
sends, so it has to support fx sends:

- **nb voices and engines that support sends** have their own `send a` /
  `send b` (or similar) params, for example [[doubledecker]], [[emplaitress]],
  and [[fx_resonator]] used as an nb voice. Look for them in that voice's params.
- **Any other engine** writes nothing to the send buses. Effects in `send a` /
  `send b` stay silent with it, so use `insert`.

**There's no return level either.** To set how loud a send effect comes back,
lower the **send amount** on the voice, or use the effect's own output/level
param if it has one.

Some effects, such as fx_grains, can sound quiet. Try a send amount around
**0.35 or higher** on the voice.

## Recipes

Common setups, each built from the pieces above. Install the effects named, turn
them on in SYSTEM → MODS and restart before you play.

### Reverb on a synth script

Install [[fx_dverb]] (a plate reverb). Load a synth script like [[sines]] or
[[dronecaster]], set **fx dverb → slot** to `insert`, and bring the dry/wet down
from fully wet until the reverb sits behind the sound rather than on top of it.

### Delay into reverb

The classic chain: echoes that fade into a room. Install [[fx_rele]] and
[[fx_dverb]].

1. Set **fx rele → slot** to `insert` first.
2. Then set **fx dverb → slot** to `insert`. It goes after the delay, so the
   echoes are reverberated too.
3. Mix each with its own dry/wet.

Want the reverb first instead? Set fx rele to `none` and back to `insert`; it
moves to the end of the chain.

fx_rele can sync to the norns clock, but it doesn't follow tempo changes. After
changing the tempo, set its rate again.

### One shared reverb for several nb voices

Put [[fx_dverb]] (or any reverb) in `send a`. In each nb voice that supports
sends, such as [[emplaitress]], raise its **send a** amount: more for the voices
you want far away, zero for the ones you want dry. Voices without send params
stay dry.

### Effects on the audio input

The dry input you hear is norns' **MONITOR** level, which crone mixes directly;
it never reaches SuperCollider's effects. To process the input:

1. Install [[preFX]] and set it to **`post eng`**. It writes the input to the
   main out bus, where inserts pick it up. This works with any engine.
2. Set any effect to `insert`.
3. Turn **MONITOR** down in the norns mixer, or you'll hear the dry and
   processed input together.

### Freeze and beat repeat

[[fx_pete]] is a freeze delay / beat repeater meant to be played. It works best
as an insert at 100% wet (dry/wet `0/100`), so that what you hear is either the
live sound passing through or the frozen slice. Like fx_rele, it doesn't follow
tempo changes; set its rate again after changing the tempo.

## Choosing effects

Here are some of the effects available for the fx mods. Install any of
them with `;install <repo>` from their page, then turn them on in SYSTEM → MODS.

### Saturation and distortion

| effect            | what it is                                                                    |
| ----------------- | ----------------------------------------------------------------------------- |
| [[fx_tanh]]       | tanh saturator, one gain knob. Also the simplest code example for developers. |
| [[fx_distortion]] | distortion ported from Pedalboard                                             |
| [[fx_bitcrusher]] | bitcrusher ported from Pedalboard                                             |

### Delay

| effect       | what it is                                                       |
| ------------ | ---------------------------------------------------------------- |
| [[fx_delay]] | a simple delay with a gentle filter                              |
| [[fx_rele]]  | multimode delay: stereo, dual mono or ping-pong, with clock sync |
| [[fx_pete]]  | freeze delay / beat repeater (best as a 100% wet insert)         |
| [[fx_llll]]  | creative multitap delay with two built-in modulators             |

### Reverb and chorus

| effect        | what it is                                                      |
| ------------- | --------------------------------------------------------------- |
| [[fx_dverb]]  | Dattorro plate reverb                                           |
| [[fx_reflex]] | creative reverb with two built-in modulators (made with an LLM) |
| [[fx_koro]]   | chorus, "a tiny ensemble"                                       |

### Filters and resonators

| effect                          | what it is                                                   |
| ------------------------------- | ------------------------------------------------------------ |
| [[fx_filter]]                   | DFM1 filter                                                  |
| [[fx_comb]]                     | comb filter                                                  |
| [[fixed-filter-banking-crisis]] | fixed filter bank                                            |
| [[fx_resonator]]                | Mutable Instruments Rings; also an nb voice. Needs mi-UGens. |

### Granular and multi-effect

| effect                                                                          | what it is                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [[fx_grains]]                                                                   | Mutable Instruments Clouds with LFO/random modulation. Needs mi-UGens.                                                                                                                                           |
| [[fx_miUGens]]                                                                  | seven Mutable-based effects in one mod: granular, texture, reverb with freeze, lowpass, µ-law crunch, cross/ring modulation and a resonator. Has its own mi-UGens installer.                                     |
| [fx_beads](https://github.com/glassgarden/mi-UGens/tree/main/examples/fx_beads) | Mutable Instruments Beads, Clouds' successor: quality modes, freeze, randomness and a built-in reverb. An example in the glassgarden mi-UGens repo: copy it to `dust/code/fx_beads/`. Needs mi-UGens with Beads. |

### Experimental

[[fx_delayyy]], [[fx_shimmer]] (shimmer reverb) and [[fx_spring]] (spring
reverb) are sonoCircuit's unreleased experiments: they may change or not work.

### Mutable Instruments effects need mi-UGens

[[fx_resonator]], [[fx_grains]], [[fx_miUGens]] and fx*beads are built on
**mi-UGens**, the SuperCollider versions of Mutable Instruments modules. They
aren't part of norns, so they have to be installed once. The order matters, and
there must only ever be **one copy**: two copies stop SuperCollider from starting
(\_SUPERCOLLIDER FAIL*).

The smoothest route is to install mi-UGens **first**, before any of these
effects:

- **[glassgarden/mi-UGens](https://github.com/glassgarden/mi-UGens)**
  (recommended): all 13 modules, including **Beads**, with newer fixes. The
  easiest way in is through a script or mod that needs it:
  - [[fx_miUGens]]: the first time a script loads with mi-UGens missing, it
    asks once (K3 installs, K2 is "not now"). After that, install or update
    from SYSTEM → MODS → `FX_MIUGENS`: **install mi-UGens** is the last row.
  - [[terrarium]]: it asks the first time you run it, and waits on that screen
    until mi-UGens are installed and norns has restarted.

  Both use [norns-deps](https://github.com/vehka/norns-deps), which shows what
  it will install, downloads a pinned, checksum-verified release, moves older
  copies aside so you never have two, and offers the restart when it's done.
  They install the same copy to the same place, so installing it for one
  covers the other. Each can also remove it again (fx_miUGens from its menu,
  terrarium from its params), and only removes what it installed itself. You
  can also install it without either, with the repo's `mi-ugens-install`
  script (its README has the steps).

- **[okyeron/mi-UGens](https://github.com/okyeron/mi-UGens)**, the older norns
  build that fx_grains, fx_resonator and emplaitress download on their own when
  they find no copy. It has no Beads. If you need it by hand, the command is in
  [troubleshooting](#troubleshooting).

Effects that download mi-UGens themselves only do it when none is installed,
and only after SuperCollider has started (and failed), so on their own they
take **2–3 restarts** to work. Turn the mod on in SYSTEM → MODS _before_
restarting. Installing mi-UGens first avoids all of that.

If another script, like [[pedalboard]], offers to install mi-UGens when you
already have them, decline or check if it's installing an older version.

### Tips

- **CPU:** granular and resonator effects are the heaviest. Running two of them
  at once may crackle; drop one, or use the lighter effects.
- **fx_grains:** _freeze_ and _lofi_ are continuous 0–1 params but act as on/off.
  Keep turning E3 until they switch.
- **Presets:** a script loads its PSET before mods add their params, so effect
  settings usually aren't restored from it.

## What works and what doesn't

| source                                                            | insert                         | send a / b                            |
| ----------------------------------------------------------------- | ------------------------------ | ------------------------------------- |
| SuperCollider engines (most synth scripts)                        | ✅                             | only if the engine supports sends     |
| nb voices that support sends (doubledecker, emplaitress, ...)     | ✅                             | ✅                                    |
| **softcut** ([[mlre]], [[cheat_codes_2]], [[wrms]], ...)          | ❌                             | ❌                                    |
| audio input / MONITOR                                             | only with preFX / pass-through | only with a send-capable input engine |
| scripts whose engine adds synths at the very end of the node tree | ❌ or partial                  | —                                     |

**Why softcut doesn't work:** in norns' routing, softcut comes _after_
SuperCollider. SuperCollider's output feeds softcut, not the other way round.
The fix is to re-route JACK so softcut feeds SuperCollider's input; [[otis]] and
[[splnkr]] do this. Then use preFX or SimplePassThru (see
[for developers](#for-developers-making-a-voice-send-to-fx)) so the input
reaches the inserts. If your script re-routes JACK, restore the routing on
cleanup.

**Engines that add synths at the end of the tree:** an engine that adds synths
with `Synth.tail(...)` / `\addToTail` on the root group **after** the fx group is
in place can end up behind the effects, so its sound skips the inserts
([[graintopia]] was one case). Scripts reported as not working include [[orgn]]
and [[orgnwrms]]. For engine authors: add to `context.xg`, or use `\addToHead`.

## Troubleshooting

**SUPERCOLLIDER FAIL right after installing an effect**

- Check that the **fx** mod is installed (folder `dust/code/fx`).
- Mutable effects (`Class 'MiRings' not found`, `MiClouds`, `MiPlaits`,
  `MiBeads`): mi-UGens are missing or too old. Install
  [glassgarden/mi-UGens](https://github.com/glassgarden/mi-UGens) as described
  in [Mutable Instruments effects need mi-UGens](#mutable-instruments-effects-need-mi-ugens),
  then restart.
- SuperCollider fails although mi-UGens are installed: there may be **two
  copies** (installed by different scripts or effects, or class files inside
  `dust/`). The glassgarden installer moves older copies aside and warns in
  maiden about stray files in `dust/`.
- The older okyeron build can also be installed by hand from the maiden REPL
  (it has no Beads), then restart:

  ```lua
  os.execute("wget -T 180 -q -P /tmp/ https://github.com/okyeron/mi-UGens/raw/master/linux-norns-binaries/mi-UGens-linux-v.03.tar && tar -xvf /tmp/mi-UGens-linux-v.03.tar -C /tmp && mkdir -p /home/we/.local/share/SuperCollider/Extensions/ && cp -r /tmp/mi-UGens-linux-v.03/* /home/we/.local/share/SuperCollider/Extensions/ && rm -r /tmp/mi-UGens-linux-v.03 /tmp/mi-UGens-linux-v.03.tar")
  ```

**No effect params show up**

- The fx mod itself has no params; only effect mods do. Check that at least one
  effect is turned on in SYSTEM → MODS, and look in maiden for errors.

**An effect set to insert does nothing**

- Is the script softcut-based? See [what works](#what-works-and-what-doesn-t).
- The engine may put its synths after the fx group (same section).

**An effect is silent after loading a pset or switching scripts**

- Set the slot to `none`, then back to `insert` / `send`. A slot that was set
  before the fx groups existed, or carried over from the previous script, can be
  ignored; toggling resets it.

**An effect in send a / send b is silent**

- The voice must support sends, and its send level must be above 0. See
  [send levels](#send-levels).

**Inspect the routing**

- In maiden's SuperCollider REPL, `s.queryAllNodes` prints the node tree. The fx
  group should be last, with the send group before the insert group.

## For developers: making a voice send to fx

The fx mod provides two global stereo buses, `~sendA` and `~sendB`. Write to
them with a level param, and fall back to the main out if the mod isn't there:

```supercollider
SynthDef(\myVoice, { |out, sendABus, sendBBus, sendA = 0, sendB = 0, freq = 220|
    var snd = SinOsc.ar(freq ! 2) * 0.1;
    Out.ar(out, snd);
    Out.ar(sendABus, snd * Lag.kr(sendA));
    Out.ar(sendBBus, snd * Lag.kr(sendB));
}).add;

Synth(\myVoice, [
    \out, context.out_b,
    \sendABus, ~sendA ? context.out_b,
    \sendBBus, ~sendB ? context.out_b,
], context.xg);
```

The same pattern sends the **audio input** to the effects (from sonoCircuit,
forum post #109):

```supercollider
SynthDef(\passthruFx, { |inBus, outBus, sendABus, sendBBus, level = 1, sendA = 0, sendB = 0|
    var snd = In.ar(inBus, 2) * Lag.kr(level);
    Out.ar(sendABus, snd * Lag.kr(sendA));
    Out.ar(sendBBus, snd * Lag.kr(sendB));
    Out.ar(outBus, snd);
}).add;

Synth(\passthruFx, [
    \inBus, context.in_b[0].index,   // in_b is two adjacent mono buses
    \outBus, context.out_b,
    \sendABus, ~sendA ? context.out_b,
    \sendBBus, ~sendB ? context.out_b,
], context.ig, \addToTail);
```

Expose `sendA` / `sendB` as engine commands and Lua params. In the fork the
buses are allocated at the first script's `script_pre_init`, so they exist
before your engine's synths are created.

**A script with no engine** (a softcut script, say) can still feed the inserts:
set `engine.name = "SimplePassThru"` and call `engine.amp(1)` in `init`. That's
norns' built-in pass-through engine.

## For developers: writing an effect

An effect is its own norns mod with a Lua side and a SuperCollider class.
[[fx_tanh]] is the simplest template.

**`lib/tanh.sc`**

```supercollider
FxTanh : FxBase {
    *new {
        // newCopyArgs(syn, slot, params, replacer, drywet)
        ^super.newCopyArgs(nil, \none, (gain: 1.5), nil, 1);
    }

    *initClass { FxSetup.register(this.new); }

    subPath { ^"/fx_tanh"; }   // OSC path; must match `subpath` in Lua
    symbol  { ^\fxTanh; }      // SynthDef name

    addSynthdefs {
        SynthDef(\fxTanh, { |inBus, outBus|
            var input = In.ar(inBus, 2);
            Out.ar(outBus, (\gain.kr(1) * input).tanh);
        }).add;
    }
}
```

**`lib/mod.lua`**

```lua
local fx = require("fx/lib/fx")
local mod = require 'core/mods'

local FxTanh = fx:new{ subpath = "/fx_tanh" }

function FxTanh:add_params()
  params:add_separator("fx_tanh", "fx tanh")   -- or params:add_group to tuck it away
  FxTanh:add_slot("fx_tanh_slot", "slot")
  FxTanh:add_taper("fx_tanh_gain", "gain", "gain", 0, 10, 1.5, 1.3, "")
end

mod.hook.register("script_pre_init", "tanh mod pre init", function()
  FxTanh:install()   -- wraps the script's init() to add params after it
end)

return FxTanh
```

Rules:

- The synth gets only `inBus` and `outBus`, plus the current values in `params`
  as named controls. Read **stereo** from `inBus`; write **100% wet** stereo to
  `outBus` with `Out.ar`. Dry/wet for inserts is handled for you.
- `subPath` (SC) and `subpath` (Lua) must match; they are the OSC address
  (`<subpath>/slot`, `<subpath>/set`).
- `symbol` must match the SynthDef name.
- Param helpers in `fx.lua`: `add_slot`, `add_control`, `add_taper`,
  `add_option`, `add_binary`. The `key` argument is the SynthDef control name.
- Avoid names that collide with fx's own (`wet` caused bugs for one effect).
- Several effects can live in one repo, but norns allows **one mod per repo**
  (only one `lib/mod.lua`). [[fx_miUGens]] registers seven effects from one mod.

Made an effect? [Submit it]({{base}}/about/) to the catalog: it shows up in this guide
automatically if you tag it `fx`.

## What sonoCircuit's fork changes

Compared with [sixolet/fx](https://github.com/sixolet/fx) (details in forum post

# 111)

- **Bus allocation moved to `script_pre_init`** (`/fxmod/alloc`, run once). The
  original allocated the buses at sclang startup, sometimes before norns had
  allocated its input buses, so a send bus could share a number with the ADC
  input. That made the input leak into the sends at random. Some people relied
  on that leak; use preFX or a pass-through engine instead.
- **fx groups are rebuilt at `script_post_init`** (`/fxmod/init`), after the
  engine has loaded, so they always sit at the tail. They are freed at
  `script_post_cleanup`.
- **One send group** instead of separate A/B groups (sends add in parallel).
- **The replacer clears the wet bus** after mixing, so inserts can be chained in
  series, each with its own dry/wet.
- An `add_binary` param helper (from xmacex's PR), dry/wet shown as a ratio
  (`50/50`), and an `fx` separator in the params list.

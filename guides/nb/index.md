---
title: nb voices
summary: Play any synth, sampler, MIDI device or modular voice from any script that supports nb. How nb works, which voices exist, and how to wire them up.
topic: nb
authors:
  - carlosedp
checked: 2026-11-11
scripts:
  - nb
  - nb_plyprc
  - nb_polyperc
  - nb_mxsynths
  - doubledecker
  - nb_sidewalk
  - nb_monamie
  - nb_wavetables
  - emplaitress
  - nb_pp
  - fx_resonator
  - nb_mxsamples
  - nb_smpKit
  - nb_tonic
  - oilcan
  - nb_rudiments
  - nb_fluid
  - nb_drumcrow
  - nb_crow
  - nb_murder
  - nb_jf
  - nb_wsyn
  - nb_ex
  - nb_ex_multi
  - nb_ex_macro_2
  - nb_ansible
  - nb_txo_euro
  - nb_midiconfig
  - nb_router
  - nbin
  - nbout
  - tg
  - matrix
  - toolkit
  - sidvagn
  - dreamsequence
  - n.kria
  - washi
  - cheat_codes_2
  - mosaic
  - pit-orchisstra
  - scholastic
  - tetra
  - midarto
  - rhythms
  - raum
  - arcologies
  - flora
  - rudiments
  - colorwheel
tags:
  - nb
sources:
  - https://llllllll.co/t/n-b-et-al-v0-1/60374
  - https://github.com/sixolet/nb
  - https://github.com/sixolet/nbin
  - https://github.com/sixolet/nbout
---

**nb** (_nota bene_, introduced on the forum as "n.b. et al.") lets a norns
script play notes without caring what makes the sound. The script says "play C3
at this velocity for half a beat"; _you_ decide whether that goes to a
SuperCollider synth, a sampler, a MIDI synth on your desk, crow's outputs, or
Just Friends over i2c.

That splits two jobs that used to be one. Script authors write the sequencer or
the interface; voice authors write the sounds, once, for every script. And you
mix and match: [[n.kria]] playing [[emplaitress]], [[dreamsequence]] playing a
sample kit, [[sidvagn]] playing your modular.

nb is one third of what the forum calls the _sixolet stack_, after its author:
[[nb]] for voices, the [fx mod]({{base}}/guides/fx/) for effects, and [[matrix]] for
modulation. All three work the same way: a base that does nothing on its own,
plus plugins you install as mods.

**In this guide:**

- the three pieces nb is made of, and what you actually install,
- a five-minute walkthrough to play your first voice,
- the three ways a script can use nb, including scripts that don't support it,
- MIDI devices, presets, modulation, kits, and several voices at once,
- recipes: a keyboard over any script, nb voices into softcut loopers,
- every known voice and helper mod, grouped by what it does,
- troubleshooting (most of it is install problems), and two sections for
  developers.

## How nb is put together

| piece              | what it is                                                                                                                    | do you install it?               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **the nb library** | code that lives _inside_ each script and mod that uses it (in its `lib/nb` folder)                                            | **no**: it comes with the script |
| **voices**         | the sounds. Most are **mods**: install them, turn them on in SYSTEM → MODS, restart. MIDI devices become voices on their own. | yes, the ones you want           |
| **voice selector** | a param the script adds (often called _voice_, or one per track or output) that picks which voice it plays                    | —                                |

Because each script carries its own copy of [[nb]], **there's nothing called
"nb" to install or turn on**. If a voice's README says "requires nb", it means
"a script that supports nb".

A voice installed as a mod is available in **every** script that supports nb,
until you turn it off. MIDI is built in, so a script that supports nb can always
play your connected MIDI gear, even with no voice mods installed.

> **Always install with `;install` from maiden**, not by downloading a zip
> from GitHub. nb lives inside scripts and mods as a _git submodule_, and
> GitHub's zip files leave submodules out. A zip-installed script or mod has an
> empty `lib/nb` folder and fails to load, sometimes taking other mods down with
> it. See [troubleshooting](#troubleshooting).

## Your first voice in five minutes

We'll use [[nb_plyprc]], a 6-voice version of PolyPerc, the classic synth that
ships with norns, because it needs nothing else.

1. **Install the voice.** In maiden's REPL (the `>>` prompt):

   ```
   ;install https://github.com/sonocircuit/nb_plyprc
   ```

2. **Turn it on.** On norns, go to **SYSTEM → MODS**, select `nb_plyprc` with
   E2 and turn E3 until it shows a **+**.
3. **Restart.** **SYSTEM → RESTART**, or `;restart` in maiden. Mods only load at
   startup, and turning off the power is not a restart.
4. **Load a script that supports nb**, for example [[dreamsequence]],
   [[n.kria]] or [[flora]] (see [the full list](#scripts-that-play-nb-voices)).
5. **Find the voice selector** in **PARAMETERS → EDIT**. Where it lives depends
   on the script: a _voice_ param near the top, or one inside each track or
   output (flora has it in its own inputs/outputs section, washi under
   _Output #1 → nb Voice_).
6. **Pick `plyprc`.** After a moment its params appear as a **plyprc** group.
7. Play. Whatever the script plays now comes out of plyprc.

Change the selector to try another voice without touching the script's
patterns. Some sequencers need the clock running first: in Dreamsequence, K3
starts playback depending on PARAMETERS → CLOCK.

## Three ways a script can use nb

Not every script supports nb, and the ones that do don't all do it the same
way:

1. **Built in.** The script has its own voice selector (most of the
   [list below](#scripts-that-play-nb-voices)). Pick a voice and its params
   appear. This is the smoothest.
2. **Through MIDI, with nbout.** Any script that can send MIDI to a device
   you choose can play an nb voice through [[nbout]], which adds a virtual MIDI
   device called `nb`. This is how [[awake]] or [[zxcvbn]] play nb voices.
3. **Alongside, with nbin, tg or sidvagn.** These mods play nb voices _next
   to_ whatever script is running: [[nbin]] from a MIDI controller,
   [[tg]] from params and modulation, [[sidvagn]] from a second grid.

### Using nbout with any MIDI script

1. Install [[nbout]], turn it on, restart.
2. In **SYSTEM → DEVICES → MIDI**, put `nb` in one of the device slots.
   Some scripts only offer the first four slots, so slots 1–4 are safest.
3. In the script, send MIDI out to that slot (in awake: _outs → MIDI_, and the
   MIDI out device set to `nb`).
4. At the bottom of PARAMETERS → EDIT, in the **nbout** section, pick the voice
   for **nb midi ch 1**.

nbout listens on MIDI channel 1 only, so it plays one voice. A voice's own
params can turn up in an odd place when it's played through nbout (above the
nbout section, or inside another mod's section); scroll for them.

## MIDI devices are voices too

Every MIDI device that is **connected when the script starts** shows up in the
selector as `midi: <name> 1` (long names are shortened). It sends notes to that
device and gets three params, shown once it's selected:

- **channel** (1–16),
- **modulation cc**, the CC that nb's modulation sends (default 72),
- **bend range** in semitones (default 12). Set it to match your synth.

Some scripts offer several MIDI voices per device (`midi: <name> 2`, `3`, ...) so
you can play different channels of one device from different tracks.

Plugged the device in after loading the script? Reload the script; the list is
built at startup. If norns doesn't see the device at all, check SYSTEM →
DEVICES → MIDI first.

For synths you use often, [[nb_midiconfig]] saves a named configuration per
device (port, channel, bank and program changes, the CCs it responds to). The
config appears in the selector like any voice and exposes those CCs as norns
params, saved with your presets.

## Presets and switching voices

- **The voice choice is saved with the script's pset, by name.** So the way to
  get a default voice is a default pset. If a pset names a voice you've since
  turned off, that selector stays silent until you pick another.
- **Voice settings live in the script's pset too**, not in the voice. There is
  no shared preset library across scripts for most voices, so a sound you
  build in one script stays in that script's psets. Some voices have their own
  preset or kit files for this: [[doubledecker]], [[nb_smpKit]], [[nb_tonic]],
  [[nb_mxsynths]]. (Preset files are Lua; you can also copy values between them
  by hand.)
- **Psets carry the params of every installed voice**, used or not. With many
  voice mods on, that can be hundreds of params per pset. Turn off the voice
  mods you don't use.
- **A voice's params only show while some selector uses it.** If you can't
  find a voice's settings, select it first; they appear after a moment, and
  hide again when nothing uses the voice.

## Modulation, expression and kits

Beyond notes and velocity, nb has a few optional channels. A voice says which
ones it supports, and the script uses what's there:

| feature        | what it does                                                                                                              | used by                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **modulate**   | one 0–1 "macro" knob per voice; the voice decides what it moves (often a morph between settings, filter cutoff, fx sends) | [[sidvagn]]'s mod key; many sonoCircuit voices                  |
| **pitch bend** | bends notes by semitones                                                                                                  | scripts with bend; MIDI voices use the bend range param         |
| **note mods**  | per-note expression, like pressure (aftertouch)                                                                           | [[nbin]] with an MPE controller and [[emplaitress]]             |
| **slew**       | glide time between notes                                                                                                  | voices that support it, such as Just Friends in individual mode |

Many voices that support **modulate** also expose it as a **mod amt** param, so
you can MIDI-map it and use the morph with scripts that never send modulation.
[[nb_plyprc]], [[nb_mxsynths]], [[nb_mxsamples]], [[nb_monamie]] and
[[nb_smpKit]] work this way.

**Kits.** A voice can describe itself as a _kit_: each note picks a different
drum rather than a pitch. Scripts that understand this, like [[n.kria]], don't
apply scales to kit voices. [[oilcan]] is a kit; so are [[nb_tonic]] and
[[nb_smpKit]] in practice (one sample or drum per note), and nb_jf has a kit
mode.

## Several selectors, one voice

When two selectors pick the **same** voice, they share it: one synth, one set of
params. Two tracks both on `plyprc`, or both of sidvagn's keyboard slots on
`smpKit`, play the same instance with the same sound.

To give each track its own sound, pick voices that come in numbered copies, each
with its own params:

- [[emplaitress]]: four Plaits voices (`emplait 1`–`4`),
- [[nb_pp]]: four Plaits Palette voices,
- [[nb_fluid]]: `fluid 1` … `fluid N`, one MIDI channel of FluidSynth each,
- [[nb_polyperc]]: 1–6 PolyPerc
  instances, set in SYSTEM → MODS → NB_POLYPERC before loading a script,
- MIDI voices: one per channel, as above.

Or mix voices: drums on [[nb_tonic]], bass on [[nb_mxsynths]], lead on
[[nb_sidewalk]].

## Recipes

### Play a voice from a MIDI keyboard over any script

[[nbin]] plays an nb voice from a MIDI controller while another script runs: a
synth over [[mlre]], Just Friends over [[otis]].

1. Install [[nbin]] with `;install`, turn it on, restart.
2. In the **nb midi in** section of PARAMETERS → EDIT, set **midi source** to
   your controller's port and pick a **voice**.
3. Play.

nbin's port setting was off by one until a fix in September 2025: on an older
copy you had to pick the slot _after_ your device. Update nbin (`;install` it
again) and pick the device itself; with nothing selected it shows _disabled_. If
it's still silent, put `nb` in a SYSTEM → DEVICES → MIDI slot too; several
people needed that. Older versions of nbin also needed the [[matrix]] mod
installed and on.

nbin doesn't add the voice's own params on every version. If the voice plays
but its settings are missing, select the same voice in a script or mod that
shows them (sidvagn, a script with a selector), since it's the same shared
instance.

### Sample and loop nb voices in a softcut script

Loopers and samplers like [[mlre]], [[rpls]], [[barcode]], [[wrms]] and
[[oooooo]] record through softcut. nb voices made in SuperCollider reach softcut
through the **engine → softcut** level, which many scripts leave at zero:

1. Play the voice with [[nbin]], [[sidvagn]] or another mod that runs
   alongside the script.
2. Turn up **PARAMETERS → SOFTCUT → input engine** (also called _ENGINE →
   SOFTCUT_), so it's not at −inf.
3. In scripts that choose their recording source, pick the engine (mlre and
   [[concrete]] have a toggle).

Scripts that record through SuperCollider instead of softcut usually won't
hear nb voices without code changes. In [[oooooo]], arm and start recording by
hand (K1 + K3) instead of relying on the input threshold, which avoids feedback.

### Trigger voices from LFOs and rhythms

[[tg]] (_très grande_) turns any nb voice into two params, a trigger and a gate.
With [[matrix]] and [[toolkit]] you can then fire it from LFOs, sequences or
Euclidean rhythms, alongside any script: a kick drum on [[oilcan]] that's always
there, whatever you load.

## nb and the fx mod

Voices made in SuperCollider go through the [fx mod]({{base}}/guides/fx/)'s **inserts**
like any engine. Several also have **send a / send b** params:
[[nb_plyprc]], [[nb_mxsynths]], [[nb_mxsamples]], [[nb_smpKit]] and
[[emplaitress]], among others. They show up only when the fx mod is installed
and on. The [fx guide]({{base}}/guides/fx/#one-shared-reverb-for-several-nb-voices) has
a recipe for one reverb shared by several voices.

Emplaitress's reverb is the norns system reverb (PARAMETERS → REVERB): if it
sounds very wet or very dry, look there.

## Choosing voices

The voices known as of November 2026, grouped by what they do. Install each with
`;install <repo>` from maiden, then turn it on in SYSTEM → MODS and restart.

### Synths

| voice             | what it is                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------ |
| [[nb_plyprc]]     | PolyPerc, the norns classic, limited to 6 voices, with a mod section and fx sends          |
| [[nb_polyperc]]   | another PolyPerc, with 1–6 independent instances                                           |
| [[nb_mxsynths]]   | the [[mx.synths]] collection (synthy, icarus, ...) as one voice, with presets and fx sends |
| [[doubledecker]]  | 2-layer synth à la CS-80, with its own presets                                             |
| [[nb_sidewalk]]   | a lighter sibling of [[passersby]]                                                         |
| [[nb_monamie]]    | monami.e, an approximation of Just Friends in synthesis mode                               |
| [[nb_wavetables]] | 16-voice wavetable polysynth (also runs as a script)                                       |

### Plaits and friends

| voice            | what it is                                                            |
| ---------------- | --------------------------------------------------------------------- |
| [[emplaitress]]  | four copies of Mutable Instruments Plaits, with polyphonic expression |
| [[nb_pp]]        | the 96 models of Rubato Audio's Plaits Palette firmware, four voices  |
| [[fx_resonator]] | Mutable Rings, as an fx effect and as an nb voice                     |

### Samples and drums

| voice            | what it is                                                                  |
| ---------------- | --------------------------------------------------------------------------- |
| [[nb_mxsamples]] | [[mx.samples]] instruments, up to 12 voices (uses mx.samples' sample files) |
| [[nb_smpKit]]    | 12-slot sample player: one-shots, loops, kits                               |
| [[nb_tonic]]     | 8-voice drum synth, a port of [[supertonic]]                                |
| [[oilcan]]       | FM percussion kit, one timbre per note                                      |
| [[nb_rudiments]] | the [[rudiments]] percussion synth as a voice                               |

### Modular and hardware

These **make no sound on their own**: they play external gear, mostly through
[crow](https://monome.org/docs/crow/) over USB, CV or i2c. Install only the ones
for gear you have.

| voice                                                 | what it plays                                                                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [[nb_crow]]                                           | crow's outputs as v/oct + envelope, or paraphonic (three pitches, one envelope)                                            |
| [[nb_drumcrow]]                                       | crow itself as a 4-voice synth or drum machine (8 with two crows)                                                          |
| [[nb_murder]]                                         | several crows over i2c                                                                                                     |
| [[nb_jf]]                                             | Just Friends: individual voices with slew, poly, unison, kit, and MPE modes                                                |
| [nb_jf_two](https://github.com/kauwgomboom/nb_jf_two) | nb_jf adapted for two Just Friends in unison. A single file of mod code rather than an installable mod: not in the catalog |
| [[nb_wsyn]]                                           | w/ in synth mode, with its timbre params MIDI-mappable                                                                     |
| [[nb_ex]]                                             | Expert Sleepers Disting EX (also reported working with the NT)                                                             |
| [[nb_ex_multi]]                                       | several Disting EXs                                                                                                        |
| [[nb_ex_macro_2]]                                     | the EX's Macro Oscillator 2 as four mono voices                                                                            |
| [[nb_ansible]]                                        | Ansible CV/gate over i2c, with poly support                                                                                |
| [[nb_txo_euro]]                                       | TELEXo trigger/CV pairs                                                                                                    |
| [[nb_fluid]]                                          | not hardware, but General MIDI: FluidSynth with any SoundFont                                                              |

**Tuning CV voices:** nb_crow and nb_ansible can tune for you. Patch the
oscillator (attenuated) into norns' left input and press the voice's **tune**
trigger. Ansible doesn't output negative voltages, so tune its oscillators low.

### Helper mods

| mod               | what it does                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------- |
| [[nbout]]         | a virtual MIDI device called `nb`: any script with MIDI out plays an nb voice through it |
| [[nbin]]          | play nb voices from an external controller while another script runs; supports MPE       |
| [[tg]]            | trigger and gate nb voices from params, or from any modulation source with [[matrix]]    |
| [[nb_midiconfig]] | named configs for your MIDI devices, with their CCs as params                            |
| [[nb_router]]     | route notes to several nb voices at once                                                 |

### Tips

- **Emplaitress needs two restarts.** Turn it on, then restart; SuperCollider
  fails the first time because the Mutable Instruments UGens download only
  after it starts. Restart again (from SYSTEM → RESTART or `;restart`, not by
  switching off). The download needs a working internet connection. To skip
  the double restart, install [glassgarden/mi-UGens](https://github.com/glassgarden/mi-UGens)
  first or install a script that already requires it like [[fx_miUGens]] first.
  Emplaitress only downloads its own copy when it finds none (the
  [fx guide]({{base}}/guides/fx/#mutable-instruments-effects-need-mi-ugens) has
  the ways to install it).
- **Emplaitress models**, from its author: _formant_ and the drum models need
  no help; _virtual analog_ and _swarm_ sound best with the internal LPG and
  wish for a filter; go gently on _additive_'s TIMBRE. The _string_ model with
  a high decay can ring forever: switch to mono mode to stop it.
- **CPU:** idle voices cost very little; playing ones depend on the synth and
  the number of notes. plyprc uses a fraction of what smpKit does. Crackles or
  clicks when several notes hit at once usually mean CPU, or an fx insert
  driven too hard (a saturator's gain, say).
- **crow 4.0.1** had an i2c bug that froze norns when sending to i2c devices.
  Update crow if i2c voices freeze.
- **nb_drumcrow and other crow voices** fight over crow's outputs. Turn off
  nb_drumcrow when you use other crow mods, and clear the script on crow
  (from druid) before starting.

## Scripts that play nb voices

These scripts in the catalog support nb, so any voice above works with them:

- sequencers: [[n.kria]], [[dreamsequence]], [[mosaic]], [[scholastic]],
  [[pit-orchisstra]], [[tetra]], [[arcologies]], [[rudiments]], [[rhythms]],
  [[colorwheel]]
- instruments and keyboards: [[sidvagn]] (a sidecar grid mod that runs
  alongside other scripts and plays two nb voices), [[flora]], [[raum]]
- loopers and more: [[cheat_codes_2]], [[washi]], [[midarto]]

Any script with selectable MIDI out works too, [through nbout](#using-nbout-with-any-midi-script).
Missing one? Scripts that support nb are tagged `nb`; [suggest an edit](https://github.com/carlosedp/splines/edit/main/guides/nb/index.md)
to add yours.

## Troubleshooting

**Mods turn themselves off after I enable nbin or nbout**, or maiden shows
`module 'nbin/lib/nb/lib/nb' not found`

- The mod was installed from a GitHub zip, so its `lib/nb` folder is empty.
  Delete the mod's folder in `dust/code`, then install it from maiden:
  `;install https://github.com/sixolet/nbin`. The same applies to any script
  or mod that uses nb.

**nbin won't load at all**

- Update it with `;install`. Older versions needed the [[matrix]] mod; if you
  run one, install and enable matrix first.

**A voice isn't in the selector**

- Is the mod turned on in SYSTEM → MODS, and did you restart afterwards?
- For a MIDI device: was it connected before the script started?
- Check maiden for errors; a voice whose SuperCollider side failed may not
  register.

**SUPERCOLLIDER FAIL after installing a voice**

- Restart once more; some voices compile on the second start.
- Emplaitress: restart twice with the mod on, and make sure norns is online for
  the UGen download. Installing [[pedalboard]] and Emplaitress at the same time
  can leave duplicate UGens; install one, restart, then the other. Two copies of
  mi-UGens stop SuperCollider from starting:
  [glassgarden/mi-UGens](https://github.com/glassgarden/mi-UGens)' installer
  moves older copies aside.
- To see what failed, open maiden's **sc** tab and run `;restart`.

**A hardware voice makes no sound**

- crow, Ansible, Just Friends, w/ and Disting voices only play that gear. For
  sound from norns itself, pick a synth or sample voice.

**I selected a voice but can't find its params**

- Give it a moment; voices show their params shortly after being selected.
  Where they appear depends on the script, and on the order mods load in, which
  isn't fixed. Through nbout or nbin they can land in another section.

**Notes keep sounding**

- Switch the selector to `none` and back, or load the pset again.
- [[doubledecker]] doesn't stop its notes when you switch away from it. Before
  switching, make sure nothing is playing; if a note hangs, go to doubledecker's
  params and change its voice setting to release it.
- In [[sidvagn]], a key combo stops all notes on its voices.

**Two tracks sound the same**

- They picked the same voice, which is shared. See
  [several selectors, one voice](#several-selectors-one-voice).

**nbout isn't offered as a MIDI device in a script**

- Put `nb` in one of the first four slots of SYSTEM → DEVICES → MIDI. Some
  scripts only list a few slots; others can't choose their MIDI device at all.

## For developers: using nb in a script

Add nb to your script as a git submodule in `lib/nb`:

```
git submodule add https://github.com/sixolet/nb.git lib/nb
```

Update it later with `git submodule update --remote` and commit. Then, in your
script:

```lua
local nb = require "nb/lib/nb"

function init()
  nb.voice_count = 1             -- optional, before init: MIDI voices per device
  nb:init()                      -- first: finds MIDI devices, stops stray notes
  nb:add_param("voice", "voice") -- a voice selector param (add as many as you need)
  -- ... the rest of your params ...
  nb:add_player_params()         -- last: every voice's params (hidden until selected)
end

local function play(note)
  local player = params:lookup_param("voice"):get_player()
  player:play_note(note, 0.8, 0.5)   -- velocity 0–1, length in beats (norns clock)
end
```

Good practice:

- **Call `nb:add_player_params()` towards the end of `init`**, after your own
  params, so the voices' groups don't land in the middle of your menu.
- **Prefer `play_note`** over `note_on` / `note_off` pairs: it schedules the
  note off for you. A missed `note_off` (when transposing, say) hangs notes on
  sustaining voices like doubledecker.
- Call `get_player()` when you play rather than caching the player: it returns
  the voice currently selected.
- Call `nb:stop_all()` when a pset loads (in `params.action_read`).
- `player:describe()` tells you what a voice supports (`supports_bend`,
  `supports_slew`, `note_mod_targets`, what `modulate` does, and
  `style = "kit"` for kit voices). Use it to skip scales on kits and to offer
  bend or expression only where it works.
- Optional calls: `player:modulate(0–1)`, `player:pitch_bend(note, semitones)`,
  `player:modulate_note(note, key, value)`, `player:set_slew(seconds)`. Voices
  that don't support one ignore it.
- Not using git? Copy nb into your script's `lib/nb` folder; the `require`
  path stays the same.

nb's own repo includes a tiny example script (`nb.lua`) that plays the selected
voice from a grid. It's the quickest way to see all of the above working.

## For developers: writing a voice

A voice is a Lua table with note methods, added to the global `note_players`
table before the script calls `nb:add_param`. As a mod, register it in the
`script_pre_init` hook. This is the shape [[nb_plyprc]] uses, and plyprc is a
good template to copy (sonoCircuit started from dstroud's nb_polyperc):

```lua
local mod = require 'core/mods'

local function add_player()
  local player = {}

  function player:add_params()
    params:add_group("myvoice_group", "my voice", 1)
    params:add_control("myvoice_cutoff", "cutoff", controlspec.FREQ)
    params:hide("myvoice_group")       -- shown only while selected
  end

  function player:active()             -- some selector picked this voice
    params:show("myvoice_group")
    _menu.rebuild_params()
  end

  function player:inactive()           -- no selector uses it any more
    self:stop_all()                    -- don't leave notes hanging
    params:hide("myvoice_group")
    _menu.rebuild_params()
  end

  function player:note_on(note, vel) --[[ start a note: vel is 0–1 ]] end
  function player:note_off(note) --[[ release it ]] end
  function player:stop_all() --[[ silence everything ]] end

  function player:describe()
    return { name = "my voice", supports_bend = false, supports_slew = false }
    -- add style = "kit" if each note is a different drum
  end

  if note_players == nil then note_players = {} end
  note_players["my voice"] = player   -- the name shown in the selector
end

mod.hook.register("script_pre_init", "my voice pre init", add_player)
```

Notes:

- nb fills in defaults for everything you leave out. `play_note` is built from
  `note_on` and `note_off`, so implement those two at least.
- **Implement `stop_all`, and call it from `inactive`.** It's how scripts (and
  sidvagn's panic combo) stop stuck notes, and how a voice cleans up when the
  user switches away from it.
- A voice's sound usually lives in SuperCollider as a class shipped with the
  mod (`lib/*.sc`), controlled over OSC on `localhost:57120`, because the
  script's own engine slot is taken. SuperCollider voices write straight to the
  main output, which is why they reach the fx mod's inserts but not, say,
  [[pedalboard]]'s input.
- To support the [fx mod]({{base}}/guides/fx/#for-developers-making-a-voice-send-to-fx),
  write to `~sendA` / `~sendB` and hide the send params when `fx` isn't loaded
  (`require('core/mods').is_loaded("fx")`).
- If your voice needs extra UGens, tell people they'll need a second restart,
  and check the download worked: a silent failure shows up as SUPERCOLLIDER
  FAIL with no clear reason.
- You can also ship a voice inside a script, without a mod: add it to
  `note_players` before calling `nb:add_param`.

Made a voice? [Submit it]({{base}}/about/) to the catalog: tagged `nb`, it shows up in
this guide automatically.

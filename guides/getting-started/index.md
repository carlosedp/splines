---
title: getting started
summary: New to norns? Connect to wifi, open maiden, install and run your first script, and learn your way around the menus, params and mods.
topic: start
authors:
  - carlosedp
checked: 2026-11-11
scripts:
  - awake
sources:
  - https://monome.org/docs/norns/
  - https://monome.org/docs/norns/maiden/
  - https://monome.org/docs/norns/mods/
---

New to norns, or just skipped the manual? This guide gets your first script from
{{title}} running in a few minutes, and shows you around enough to follow the
other guides. For the full story, monome's own
[norns documentation](https://monome.org/docs/norns/) is the place to go.

If you have interest into getting a norns device, check this [post](https://www.reddit.com/r/norns/comments/1xcjr4i/getting_a_norns_in_2026_new_used_kits_and_diy/) that was written on Reddit. It
provides information on getting a built or DIY kit norns device.

## What you need

- a **norns** (the original, a norns shield or fates all work the same way),
- a **wifi network** it can join, and a computer or tablet on the same network,
- headphones or speakers. A grid, arc, MIDI controller or crow is optional:
  many scripts need none of them, and each script page says what it uses.

## Before you install anything: pick wisely

_{{title}} lists the scripts their authors chose to share, not just the polished
ones. It does not check that each one installs, runs on current norns, or does
what it says. Some are experiments, some are unfinished, and some haven't been
touched in years._

For your first scripts, stick to the well-known ones:

- **Sort by [most GitHub stars]({{base}}/?sort=stars)** or
  **[most liked]({{base}}/?sort=likes)**. Popular scripts are popular because
  they work and people use them.
- **Look at the last push date.** A script updated recently is more likely to
  run on today's norns, but take care with brand-new scripts that may still be
  experimental.
- **Skip anything with ⚠️.** It means the repository was archived or no longer
  exists.
- **Check the hardware badges** (grid, arc, midi, crow…). A script that requires
  a grid won't do much without one.
- **Read the script page.** It shows the author's README with the controls; most
  norns scripts make more sense once you know what the keys and encoders do.

Not sure where to begin? [[awake]] comes with norns, makes sound straight
away, and is the script most tutorials start from. It also works with Grid if
you have one connected.

Once you know your way around, explore the long tail. That's where the surprises
are.

## Find your way around norns

norns has three keys (**K1**, **K2**, **K3**) and three encoders (**E1**,
**E2**, **E3**). Inside a script, they do whatever the script says. To get to
the system menu:

- **K1** (a short press) opens and closes the menu, from any script.
- **E1** moves between the menu's pages: **LEVELS** (audio levels), **TAPE**
  (recording), **HOME** and **PARAMETERS**.
- **E2** scrolls, **K3** selects or goes in, **K2** goes back.

**HOME** has **SELECT** (load a script), **SYSTEM** (devices, wifi, mods,
restart, update) and **SLEEP** (turn norns off safely).

### Params and psets

Almost everything a script lets you set lives in **PARAMETERS → EDIT**. It
starts with norns' own settings (levels, reverb, compressor, softcut, clock),
then the script's params: sounds, scales, MIDI devices. Mods add their settings
there too, usually near the end of the list. That's where the other guides send you most of the time.

**PARAMETERS → PSET** saves and loads _presets_ (psets): a snapshot of all of a
script's params. Save one when you have a sound you like; load it next time.
Psets belong to the script that made them.

## 1. Connect norns to wifi

On norns, go to **SYSTEM → WIFI**, pick your network and enter the password.
When it's connected, the same screen shows norns' IP address.

## 2. Open maiden

maiden is norns' editor, and it runs in your web browser. On a computer on the
same network, open:

```
http://norns.local
```

If that doesn't load (some networks and Windows setups don't resolve `.local`
names), type the IP address from step 1 instead, e.g. `http://192.168.1.23`.

At the bottom of maiden there's a **REPL**: a text field with a `>>` prompt, and
two tabs above it. **matron** shows what scripts and mods print, including their
errors; **sc** (SuperCollider) shows the sound engine's messages. When something
fails, the answer is usually in one of them.

## 3. Install a script

Every script page on {{title}} has a copy button with the command to paste into
the REPL. It looks like this:

```
;install https://github.com/author/script
```

Mind the semicolon at the start, then press Enter. maiden downloads the script
into `dust/code/` on your norns and prints a message when it's done.

maiden also has a project manager (in the left sidebar) that lists the official
community catalog with install and update buttons. Either way works.

> **Don't install by downloading a zip from GitHub** and copying it over. Many
> scripts and mods include other code as _git submodules_, which GitHub's zip
> files leave out. The script then fails in confusing ways. `;install` and the
> project manager fetch everything.

## 4. Run it

On norns:

1. press **K1** to open the menu,
2. on the **HOME** page, highlight **SELECT** with **E2** and press **K3**,
3. scroll to the script with **E2** and press **K3** to load it.

Or, in maiden, open the script's main `.lua` file and press the play button.

If norns shows an error about a missing **engine**, the script brought a new
sound engine with it: go to **SYSTEM → RESTART**, then load the script again.
That's normal the first time.

## Restart is not power off

When a script, mod or guide says _restart_, it means **SYSTEM → RESTART** on
norns, or typing `;restart` in maiden's REPL. That restarts norns' software,
which is what loads new engines and mods.

Turning norns off and on works too, but always go through **SLEEP** first, never
by pulling the power: norns is a small computer, and cutting power while it's
writing can corrupt its SD card.

## Mods are different

Some entries are **mods**: they extend norns itself instead of running as a
script, and they work under every script you load. After installing one:

1. go to **SYSTEM → MODS**, select it with **E2** and turn **E3** until it shows
   a **+**,
2. restart norns.

A mod's settings show up in PARAMETERS → EDIT once a script is loaded, or in
SYSTEM → MODS for some. Turn a mod off the same way (E3 until the + disappears)
and restart. See monome's [about mods](https://monome.org/docs/norns/mods/).

Two families of mods are worth knowing early, and each has its own guide:

- the **[fx mod]({{base}}/guides/fx/)** adds reverb, delay and other effects
  after any SuperCollider script,
- **[nb]({{base}}/guides/nb/)** lets scripts that support it play any synth,
  sampler, MIDI device or modular voice you install.

Install mods one or two at a time and get to know them before adding more: they
all add params, and many at once make the menus long and problems hard to trace.

## Where things live

Everything you install or make is under `dust/` on norns:

| folder        | what's in it                              |
| ------------- | ----------------------------------------- |
| `dust/code/`  | scripts and mods, one folder each         |
| `dust/audio/` | samples and recordings (TAPE saves here)  |
| `dust/data/`  | each script's saved data, including psets |

maiden's file browser (left sidebar) shows these folders. To remove a script,
delete its folder from `dust/code/` there. To copy files to and from norns from
your computer, see monome's docs on
[file transfer](https://monome.org/docs/norns/fileshare/).

## Crow, iii and teletype

These scripts don't install through maiden. Their pages link to the repository;
follow its README. For crow, monome's
[druid](https://monome.org/docs/crow/druid/) is the usual way to upload a
script. For grid and other iii devices, scripts are uploaded from the browser
with monome's [diii](https://monome.org/diii) or
[greenhouse](https://greenhouse.vfmod.com/), which also shows the device on
screen.

## When something doesn't work

- read the script's README; it often lists required norns versions, engines or
  hardware,
- update norns (**SYSTEM → UPDATE**); many scripts need a recent version,
- look at maiden's **matron** and **sc** tabs for the error, and
  include it when you ask for help,
- check the script's discussion on its page, its lines thread, or its GitHub
  issues,
- ask on the [{{title}} forum]({{forum}}) or on [lines](https://llllllll.co/),
  where the norns community lives.

And if a listed script turns out to be broken, let us know with the "suggest an
edit" link on its page, so the next person doesn't run into it.

# getting started

New to norns, or just skipped the manual? This page gets your first script from {{title}} running in a few minutes. For the full story, monome's own [norns documentation](https://monome.org/docs/norns/) is the place to go.

## before you install anything: pick wisely

_{{title}} lists the scripts their authors chose to share, not just the polished ones. Splines does not check that each one installs, runs on current norns, or does what it says. Some are experiments, some are unfinished, and some haven't been touched in years._

For your first scripts, stick to the well-known ones:

- **sort by [most GitHub stars]({{base}}/?sort=stars)** or **[most liked]({{base}}/?sort=likes)**. Popular scripts are popular because they work and people use them.
- **look at the last push date.** A script updated recently is more likely to run on today's norns but take caution with new scripts that might be experimental or unstable.
- **skip anything with ⚠️.** It means the repository was archived or no longer exists.
- **check the hardware badges** (grid, arc, midi, crow…). A script that requires a grid won't do much without one.
- **read the script page.** It shows the author's README with the controls; most norns scripts make more sense once you know what the keys and encoders do.

Once you know your way around, explore the long tail. That's where the surprises are.

## 1. connect norns to wifi

On norns, go to **SYSTEM > WIFI**, pick your network and enter the password. When it's connected, the same screen shows norns' IP address.

## 2. open maiden

maiden is norns' editor, and it runs in your web browser. On a computer on the same network, open:

```
http://norns.local
```

If that doesn't load (some networks and Windows setups don't resolve `.local` names), type the IP address from step 1 instead, e.g. `http://192.168.1.23`.

## 3. install a script

At the bottom of maiden there's a REPL: a text field with a `>>` prompt. Every script page on {{title}} has a copy button with the command to paste there. It looks like this:

```
;install https://github.com/author/script
```

Mind the semicolon at the start, then press Enter. maiden downloads the script into `dust/code/` on your norns and prints a message when it's done.

maiden also has a project manager (in the left sidebar) that lists the official community catalog with install and update buttons. Either way works.

## 4. run it

On norns:

1. press **K1** to open the menu,
2. highlight **SELECT** with **E2** and press **K3**,
3. scroll to the script with **E2** and press **K3** to load it.

Or, in maiden, open the script's main `.lua` file and press the play button.

If norns shows an error about a missing **engine**, the script brought a new sound engine with it: go to **SYSTEM > RESTART**, then load the script again. That's normal the first time.

## mods are different

Some entries are **mods**: they extend norns itself instead of running as a script. After installing one, enable it in **SYSTEM > MODS** (select it with E2, turn E3 until it shows a `+`), then restart norns. See [about mods](https://monome.org/docs/norns/mods/).

## crow, iii and teletype

These scripts don't install through maiden. Their pages link to the repository; follow its README. For crow, monome's [druid](https://monome.org/docs/crow/druid/) is the usual way to upload a script. For Grid, some scripts are iii-specific and use [diii](https://diii.vfmod.com/).

## when something doesn't work

- read the script's README; it often lists required norns versions, engines or hardware,
- update norns (**SYSTEM > UPDATE**); many scripts need a recent version,
- check the script's discussion on its page, its lines thread, or its GitHub issues,
- ask on the [{{title}} forum]({{forum}}) or on [lines](https://llllllll.co/), where the norns community lives.

And if a listed script turns out to be broken, let us know with the "suggest an edit" link on its page, so the next person doesn't run into it.

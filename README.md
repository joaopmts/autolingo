# <img src="./images/diamond-league.png" width="30" title="Autolingo"> Autolingo

A Chrome extension that completes Duolingo lessons automatically — solves challenges, grinds through your path, and even clears Legendary practice for you.

100% free. No account, no payment, no tracking — everything runs locally in your browser.

## Features

- **Automation** — solves whatever challenge is on screen (translation, listening, matching, tap-complete, fill-in-the-blank, and more) as soon as a lesson starts.
- **Auto Grind** — keeps starting your next lesson automatically, so your course keeps progressing on its own while it's on.
- **Legendary mode** — a mode on top of Auto Grind. Instead of the normal lesson, it scans your whole path for the earliest Legendary practice you haven't completed yet and does that instead.
- **Adjustable solve delay** — tune how fast it acts (0–2000ms) between steps inside a challenge.

## Installation

This isn't published on the Chrome Web Store — install it as an unpacked extension:

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right toggle).
4. Click **Load unpacked** and select the project folder.
5. Open [duolingo.com](https://www.duolingo.com) and click the Autolingo icon in your toolbar.

## How to use

Open the extension's popup and toggle what you need:

| Toggle | What it does |
|---|---|
| **Automation** | Master switch — turns the whole extension on or off. |
| **Auto Grind** | Requires Automation. Keeps auto-starting your next lesson so the course finishes itself. |
| **Legendary** | Requires Auto Grind. Switches Auto Grind to only start available Legendary practice instead of the normal lesson. |
| **Solve delay** | How long, in milliseconds, between simulated actions inside a challenge. |

Each toggle only unlocks once the one above it is on — Automation → Auto Grind → Legendary.

## Project structure

```
autolingo_src/
├── manifest.json                    Extension config (Manifest V3)
├── background.js                    Service worker — sets the toolbar badge (✓/off)
├── popup.html / popup.js / popup.css   The extension's popup UI (toggles + delay)
├── content_scripts/
│   ├── init.js                      Bridges chrome.* APIs <-> the page (isolated world)
│   ├── injected.js                  Core logic — path scanning, Auto Grind, Legendary, hotkey-free automation (main world)
│   ├── ReactUtils.js                Reads Duolingo's internal React fiber data (no public API exists)
│   ├── DuolingoSkill.js             Drives a whole lesson/story from start to finish
│   ├── DuolingoChallenge.js         Solves a single challenge (translate, select, match, tap-cloze, etc.)
│   └── main.css                     Styles for the buttons Autolingo injects onto the path
└── images/                          Icons + the tier/legendary badges shown on the path
```

**How it fits together:** `manifest.json` auto-runs `init.js` on every `duolingo.com` page. Since content scripts can't touch the page's own JavaScript, `init.js` injects `injected.js` as a real `<script>` tag so it runs in the page's own world with access to Duolingo's React internals (via `ReactUtils.js`). `init.js` and `injected.js` talk to each other through `CustomEvent`s on `document` — `init.js` forwards `chrome.storage` changes and popup messages inward, `injected.js` reports state back out. `injected.js` reads the path's React data to find eligible skills, injects the little overlay buttons, and delegates actually solving a lesson to `DuolingoSkill.js` (which drives the lesson's state machine) and `DuolingoChallenge.js` (which solves each individual challenge by challenge type). `background.js` and `popup.js` only talk to `chrome.storage.local` — that's the single source of truth all the pieces read from.

## Permissions

- `storage` — saves your toggle preferences locally via `chrome.storage.local`. Nothing leaves your browser.
- `tabs` — used to send the solve-delay setting to the active Duolingo tab.

## Disclaimer

This automates actions on your Duolingo account. Using it may go against Duolingo's Terms of Service and could put your account, streak, or leaderboard standing at risk. Use at your own risk.

## Author

Developed by João ([joaomtsplay@gmail.com](mailto:joaomtsplay@gmail.com)).

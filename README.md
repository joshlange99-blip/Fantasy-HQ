# Front Office · Fantasy HQ

A personal fantasy football command center built on Sleeper's public API. Open the site, it loads every Sleeper league you're in, and the dropdown switches between them.

**Live app:** https://joshlange99-blip.github.io/fantasy-hq/

## Features

| Tab | What it does |
|---|---|
| Matchup | Live scores for both starting lineups plus a pre-game win probability |
| Lineup | Best possible lineup using your league's scoring settings, with the exact swaps |
| Simulate | Plays a matchup 10,000 times: win %, score ranges, and the players who swing it most |
| Waivers | Every unowned player, sorted by projection, upgrade over your weakest starter, or trending adds (plus young stashes in dynasty) |
| League history | Every season back to the league's start: champions, all-time standings, finish chart, points per season, records, your head-to-head |
| Money | Shown only when the league has a buy-in: all-time net winnings, your running total, payouts by season |
| Rookie board | Dynasty only: weighted, adjustable ranking of the incoming class, plus the rookie picks you own |

## Files

- `index.html`: the whole app (HTML, CSS, JS). It calls `api.sleeper.app` straight from the browser.
- `rookies.json`: rookie prospect data. The **weekly update job** refreshes it and adds a dated entry to `updates`.
- `config.json`: settings shared by every device:
  - `sleeperUser`: your Sleeper username, so the app opens straight to your leagues
  - `money`: buy-in settings per league, keyed by league name. Example:
    ```json
    "money": {
      "Dynasty Bros": { "buyIn": 100, "payouts": [60, 30, 10], "pfBonus": 0, "overrides": { "2023": 50 } }
    }
    ```
    `payouts` = % of the pot for 1st/2nd/3rd, `pfBonus` = % for the regular-season points leader, `overrides` = a different buy-in for specific seasons. A league that isn't listed (or has `buyIn: 0`) gets no Money tab.

Settings you change inside the app (money setup, rookie edits, model weights) are saved only on that device. Anything in `config.json` applies everywhere.

## Rookie data format (`rookies.json`)

```json
{
  "asOf": "YYYY-MM-DD",
  "draftClass": 2027,
  "updates": [ { "date": "YYYY-MM-DD", "text": "What changed this week" } ],
  "prospects": [
    { "id": "jsmith", "name": "Jeremiah Smith", "pos": "WR", "school": "Ohio State",
      "ht": "6-3", "wt": 223, "pick": 2, "prod": 97,
      "ath": null, "age": null, "land": null, "note": "Short factual note" }
  ]
}
```

- `pick`: projected overall NFL draft pick (1–260). Replace it with the **actual** pick after the April draft.
- `prod`: college production, 0–100 (stats and share of the team's offense).
- `ath`: athleticism 0–100 (fill in after the combine), `age`: age on draft day, `land`: landing spot 0–100 (after the draft). `null` = average.
- Keep `id`s stable. Users' personal edits are keyed by id.
- Newest entry first in `updates`. Keep the last ~12.

## Data sources

- Sleeper public API (league data, players, trending adds) and Sleeper's projections feed. The projections endpoint isn't officially documented and could change.
- Rookie values are estimates drawn from public draft coverage and college stats. They're a starting point, not an authority.

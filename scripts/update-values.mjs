// Refreshes trade-value data for the app. Runs daily in GitHub Actions (Node 20+, built-in fetch).
//   data/dynasty-values.json  — Roster Audit dynasty values (superflex & 1QB) for PPR, half-PPR and TE-premium
//   data/picks.json           — Roster Audit rookie pick values (early/mid/late, next drafts)
//   data/redraft.json         — rest-of-season projected points per player, summed from Sleeper weekly projections
import { writeFile, mkdir } from 'node:fs/promises';

const UA = { 'User-Agent': 'fantasy-hq/1.0 (personal fantasy app; +https://github.com/joshlange99-blip/fantasy-hq)', 'Accept': 'application/json' };
const RA = 'https://rosteraudit.com/wp-json/ra/v1';
const today = new Date().toISOString().slice(0, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.ok) return await r.json();
      console.warn(`${r.status} ${url}`);
    } catch (e) { console.warn(`${e.message} ${url}`); }
    await sleep(2000 * (i + 1));
  }
  return null;
}

await mkdir('data', { recursive: true });
let failures = 0;

/* ---------- dynasty values ---------- */
const formats = {};
let attribution = 'Values by RosterAudit.com', attribution_url = 'https://rosteraudit.com';
for (const fk of ['sf_ppr', 'sf_half', 'sf_ppr_tep']) {
  const d = await get(`${RA}/rankings/values?format_key=${fk}`);
  if (!d) { failures++; continue; }
  const src = d.values && typeof d.values === 'object' ? d.values : d;
  if (d.attribution) attribution = d.attribution;
  if (d.attribution_url) attribution_url = d.attribution_url;
  const scoring = fk.replace(/^sf_/, '');            // ppr | half | ppr_tep
  const sf = {}, one = {};
  for (const [id, v] of Object.entries(src)) {
    if (!/^\d+$/.test(id) || !v || typeof v !== 'object') continue;
    if (Number.isFinite(v.sf)) sf[id] = v.sf;
    if (Number.isFinite(v['1qb'])) one[id] = v['1qb'];
  }
  formats[`sf_${scoring}`] = sf; formats[`1qb_${scoring}`] = one;
  console.log(`dynasty ${fk}: ${Object.keys(sf).length} players`);
  await sleep(1500);
}
if (Object.keys(formats).length) {
  await writeFile('data/dynasty-values.json', JSON.stringify({ asOf: today, attribution, attribution_url, formats }));
}

/* ---------- pick values ---------- */
const picks = await get(`${RA}/picks`);
if (picks && Array.isArray(picks.picks)) {
  await writeFile('data/picks.json', JSON.stringify({
    asOf: today, attribution: picks.attribution || attribution, attribution_url: picks.attribution_url || attribution_url,
    picks: picks.picks.map(p => ({ season: p.pick_season, round: p.pick_round, slot: p.pick_slot, sf: p.val_sf, '1qb': p.val_1qb })),
    curve_sf: picks.pick_curve_sf || null, curve_1qb: picks.pick_curve_1qb || null
  }));
  console.log(`picks: ${picks.picks.length}`);
} else failures++;

/* ---------- redraft: rest-of-season projections from Sleeper ---------- */
const state = await get('https://api.sleeper.app/v1/state/nfl');
if (state) {
  const season = state.season;
  const lastWeek = 18;
  const fromWeek = state.season_type === 'regular' ? Math.max(1, Number(state.display_week || state.week || 1)) : 1;
  const pos = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map(p => `position[]=${p}`).join('&');
  const tot = {}; let weeksFound = 0;
  for (let w = fromWeek; w <= lastWeek; w++) {
    const d = await get(`https://api.sleeper.app/projections/nfl/${season}/${w}?season_type=regular&${pos}`);
    if (!Array.isArray(d) || !d.length) continue;
    weeksFound++;
    for (const x of d) {
      const s = x?.stats; if (!x?.player_id || !s) continue;
      const t = tot[x.player_id] ||= [0, 0, 0, 0];
      t[0] += s.pts_ppr || 0; t[1] += s.pts_half_ppr || 0; t[2] += s.pts_std || 0; t[3] += (s.pts_ppr || s.pts_std) ? 1 : 0;
    }
    await sleep(400);
  }
  const players = {};
  for (const [id, t] of Object.entries(tot)) if (t[0] > 0.5 || t[2] > 0.5) players[id] = [+t[0].toFixed(1), +t[1].toFixed(1), +t[2].toFixed(1), t[3]];
  if (weeksFound) {
    await writeFile('data/redraft.json', JSON.stringify({ asOf: today, season, fromWeek, weeks: weeksFound, fields: ['ppr', 'half', 'std', 'games'], players }));
    console.log(`redraft: weeks ${fromWeek}-${lastWeek} (${weeksFound} with data), ${Object.keys(players).length} players`);
  } else failures++;
} else failures++;

console.log(failures ? `finished with ${failures} source(s) unavailable; kept previous files for those` : 'all sources updated');

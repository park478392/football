import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

// Run from the project root: node --env-file=.env.local scripts/download-player-photos.mjs
// Include the top five scorers and assist providers per league with --top=5.
const top = Number(process.argv.find(arg => arg.startsWith('--top='))?.split('=')[1] ?? 1)
const sourceProvider = process.argv.find(arg => arg.startsWith('--source='))?.split('=')[1] ?? 'sportsdb'
if (!['sportsdb', 'espn'].includes(sourceProvider)) throw new Error('--source must be sportsdb or espn')
if (!Number.isInteger(top) || top < 1 || top > 50) throw new Error('--top must be an integer from 1 to 50')
const key = process.env.FOOTBALL_DATA_KEY
if (!key) throw new Error('FOOTBALL_DATA_KEY is required')
const directory = resolve('public/players')
await mkdir(directory, { recursive: true })
const manifestPath = resolve(directory, 'manifest.json')
const manifest = existsSync(manifestPath)
  ? JSON.parse(await readFile(manifestPath, 'utf8')) : {}
let lastSearch = 0
async function get(url, headers = {}) {
  const host = new URL(url).hostname
  for (let attempt = 0; attempt < 2; attempt++) {
    if (host === 'www.thesportsdb.com') {
      await delay(Math.max(0, lastSearch + 2200 - Date.now()))
      lastSearch = Date.now()
    }
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) })
    if (response.status === 429 && attempt === 0) {
      const retryAfter = Number(response.headers.get('retry-after'))
      await response.arrayBuffer()
      const wait = Number.isFinite(retryAfter) ? Math.max(retryAfter * 1000, 10000) : 10000
      console.log(`Rate limited by ${host}; retrying in ${Math.ceil(wait / 1000)}s`)
      await delay(wait)
      continue
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${host}`)
    return response
  }
}
const normalize = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const espnLeagues = { PL: 'eng.1', PD: 'esp.1', BL1: 'ger.1', SA: 'ita.1', FL1: 'fra.1' }
for (const league of ['PL', 'PD', 'BL1', 'SA', 'FL1']) {
  try {
    const data = await (await get(
      `https://api.football-data.org/v4/competitions/${league}/scorers?limit=50`,
      { 'X-Auth-Token': key },
    )).json()
    const scorers = data.scorers || []
    const ranked = [
      ...[...scorers].sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0)).slice(0, top),
      ...[...scorers].sort((a, b) => (b.assists ?? 0) - (a.assists ?? 0)).slice(0, top),
    ]
    const leaders = [...new Map(ranked.map(entry => [entry.player.id, entry])).values()]
    const espnPlayers = []
    if (sourceProvider === 'espn') {
      const base = `https://site.api.espn.com/apis/site/v2/sports/soccer/${espnLeagues[league]}`
      const teams = await (await get(`${base}/teams?limit=100`)).json()
      for (const { team } of teams.sports[0].leagues[0].teams) {
        try {
          const roster = await (await get(`${base}/teams/${team.id}/roster`)).json()
          espnPlayers.push(...(roster.athletes || []))
        } catch (error) { console.error(`Roster ${team.displayName}: ${error.message}`) }
      }
      console.log(`${league}: checked ${espnPlayers.length} ESPN players`)
    }
    for (const { player, team } of leaders) {
      if (manifest[player.id] && existsSync(resolve('public', manifest[player.id].image.slice(1)))) {
        console.log(`Already saved: ${player.name}`)
        continue
      }
      try {
        let source
        if (sourceProvider === 'espn') {
          const candidates = espnPlayers.filter(candidate => {
            const sameName = [candidate.displayName, candidate.fullName, `${candidate.firstName || ''} ${candidate.lastName || ''}`]
              .some(name => name && normalize(name) === normalize(player.name))
            const sameBirthday = !player.dateOfBirth || !candidate.dateOfBirth
              || candidate.dateOfBirth.slice(0, 10) === player.dateOfBirth
            return sameName && sameBirthday && candidate.headshot?.href
          })
          const unique = [...new Map(candidates.map(candidate => [candidate.id, candidate])).values()]
          if (unique.length === 1) source = unique[0].headshot.href
        } else {
          let selected
          const plainName = player.name.normalize('NFD').replace(/\p{M}/gu, '')
          for (const query of new Set([plainName, player.name])) {
            const result = await (await get(`https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=${encodeURIComponent(query.replace(/\s+/g, '_'))}`)).json()
            const candidates = (result.player || []).filter(p => ['soccer', 'football'].includes(p.strSport?.toLowerCase()))
            selected = candidates.find(p => {
              const name = p.strTeam?.toLowerCase()
              return name && (name.includes(team.name.toLowerCase()) || team.name.toLowerCase().includes(name))
            }) || candidates.find(p => p.strPlayer && normalize(p.strPlayer) === normalize(player.name))
            if (selected?.strCutout || selected?.strRender || selected?.strThumb) break
          }
          source = selected?.strCutout || selected?.strRender || selected?.strThumb
        }
        if (!source) { console.log(`No photo: ${player.name}`); continue }
        const photo = await get(source)
        const mime = photo.headers.get('content-type')?.split(';')[0]
        const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[mime]
        if (!extension) throw new Error(`Unsupported image type: ${mime}`)
        const filename = `${player.id}.${extension}`
        await writeFile(resolve(directory, filename), Buffer.from(await photo.arrayBuffer()))
        manifest[player.id] = { name: player.name, image: `/players/${filename}`, source }
        await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
        console.log(`Saved: ${player.name} -> ${filename}`)
      } catch (error) { console.error(`${player.name}: ${error.message}`) }
    }
  } catch (error) { console.error(`${league}: ${error.message}`) }
}
console.log(`Saved photos: ${Object.keys(manifest).length}`)

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import sharp from 'sharp'

// Run with the development server available:
// node scripts/download-squad-photos.mjs
const base = 'http://localhost:3000'
const directory = resolve('public/players')
await mkdir(directory, { recursive: true })
const manifestPath = resolve(directory, 'manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const startingCount = Object.keys(manifest).length
const leagues = { PL: 'eng.1', PD: 'esp.1', BL1: 'ger.1', SA: 'ita.1', FL1: 'fra.1' }
const normalize = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const words = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${new URL(url).hostname}`)
  return response.json()
}

async function saveManifest() {
  await writeFile(`${manifestPath}.tmp`, JSON.stringify(manifest, null, 2) + '\n')
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await rename(`${manifestPath}.tmp`, manifestPath)
      return
    } catch (error) {
      if (error.code !== 'EPERM' || attempt === 4) throw error
      await delay(200 * (attempt + 1))
    }
  }
}

async function savePhoto(record, sources, filename = `${record.player.id}.webp`) {
  let source
  let response
  for (const url of [sources].flat()) {
    response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (response.status === 404 || response.status === 403) {
      await response.arrayBuffer()
      continue
    }
    source = url
    break
  }
  if (!source) return false
  if (!response.ok) throw new Error(`Image HTTP ${response.status}`)
  if (!response.headers.get('content-type')?.startsWith('image/')) return false
  const buffer = Buffer.from(await response.arrayBuffer())
  const image = sharp(buffer)
  const metadata = await image.metadata()
  if (metadata.width < 50 || metadata.height < 50) return false
  await image.resize({ width: 320, height: 400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toFile(resolve(directory, filename))
  manifest[record.player.id] = { name: record.player.name, image: `/players/${filename}`, source }
  // Write the image first, then atomically publish its manifest entry.
  await saveManifest()
  return true
}

function saved(record) {
  const entry = manifest[record.player.id]
  return entry && existsSync(resolve('public', entry.image.slice(1)))
}

const records = []
for (const league of Object.keys(leagues)) {
  const data = await getJson(`${base}/api/players?league=${league}`)
  records.push(...data.players.map(record => ({ ...record, league })))
}
console.log(`Loaded ${records.length} squad players; ${startingCount} photos already saved`)

let added = 0
if (!process.argv.includes('--fotmob') && !process.argv.includes('--fotmob-search') && !process.argv.includes('--wiki') && !process.argv.includes('--refresh-fpl')) {
  const fpl = await getJson('https://fantasy.premierleague.com/api/bootstrap-static/')
  const fplTeams = new Map(fpl.teams.map(team => [team.id, team]))
  const fplCodes = new Map(fpl.elements.map(player => [String(player.code), player]))
  for (const record of records) {
    const entry = manifest[record.player.id]
    if (!entry?.source.includes('resources.premierleague.com')) continue
    const code = entry.source.match(/\/(?:p)?(\d+)\.png$/)?.[1]
    const candidate = fplCodes.get(code)
    if (record.player.dateOfBirth && candidate?.birth_date && record.player.dateOfBirth !== candidate.birth_date) {
      delete manifest[record.player.id]
      console.log(`Discarded mismatched birthday: ${record.player.name}`)
    }
  }
  await saveManifest()
  for (const record of records) {
    if (saved(record)) continue
    const target = normalize(record.player.name)
    const targetWords = words(record.player.name)
    const candidates = fpl.elements.filter(candidate => {
      if (record.player.dateOfBirth && candidate.birth_date !== record.player.dateOfBirth) return false
      const fullName = `${candidate.first_name} ${candidate.second_name}`
      const team = fplTeams.get(candidate.team)
      const teamNames = [team.name, team.short_name].map(normalize)
      const sameTeam = [record.team.name.replace(/\s+FC$/, ''), record.team.shortName].some(name => teamNames.includes(normalize(name)))
      if (!sameTeam) return false
      if ([fullName, candidate.web_name, candidate.known_name].some(name => name && normalize(name) === target)) return true
      return targetWords.length >= 2 && targetWords.every(word => words(fullName).includes(word))
    })
    if (candidates.length !== 1) continue
    const source = [
      `https://resources.premierleague.com/premierleague25/photos/players/110x140/${candidates[0].code}.png`,
      `https://resources.premierleague.com/premierleague/photos/players/250x250/p${candidates[0].code}.png`,
    ]
    try {
      if (await savePhoto(record, source)) {
        added++
        console.log(`FPL saved ${record.player.name} (${added} added)`)
      }
    } catch (error) { console.error(`${record.player.name}: ${error.message}`) }
    await delay(120)
  }
  console.log(`FPL pass complete: ${Object.keys(manifest).length} photos`)

  const espnPlayers = new Map()
  for (const [league, code] of Object.entries(leagues)) {
    const root = `https://site.api.espn.com/apis/site/v2/sports/soccer/${code}`
    try {
      const data = await getJson(`${root}/teams?limit=100`)
      for (const { team } of data.sports[0].leagues[0].teams) {
        try {
          const roster = await getJson(`${root}/teams/${team.id}/roster`)
          for (const player of roster.athletes || []) {
            if (player.headshot?.href) espnPlayers.set(player.id, player)
          }
        } catch (error) { console.error(`ESPN ${team.displayName}: ${error.message}`) }
        await delay(150)
      }
      console.log(`ESPN ${league} roster lookup complete`)
    } catch (error) { console.error(`ESPN ${league}: ${error.message}`) }
  }
  for (const record of records) {
    if (saved(record)) continue
    const candidates = [...espnPlayers.values()].filter(candidate => {
      const sameName = [candidate.displayName, candidate.fullName, `${candidate.firstName || ''} ${candidate.lastName || ''}`]
        .some(name => name && normalize(name) === normalize(record.player.name))
      return sameName && (!record.player.dateOfBirth || candidate.dateOfBirth?.slice(0, 10) === record.player.dateOfBirth)
    })
    if (candidates.length !== 1) continue
    try {
      if (await savePhoto(record, candidates[0].headshot.href)) {
        added++
        console.log(`ESPN saved ${record.player.name} (${added} added)`)
      }
    } catch (error) { console.error(`${record.player.name}: ${error.message}`) }
    await delay(120)
  }

}

if (process.argv.includes('--refresh-fpl')) {
  const fpl = await getJson('https://fantasy.premierleague.com/api/bootstrap-static/')
  const candidates = new Map(fpl.elements.map(player => [String(player.code), player]))
  const teams = new Map(fpl.teams.map(team => [team.id, team]))
  const teamKey = value => normalize(value.replace(/\bFC\b/gi, ''))
    .replaceAll('manchester', 'man').replaceAll('united', 'utd')
    .replaceAll('tottenhamhotspur', 'spurs').replaceAll('leedsutd', 'leeds')
    .replaceAll('nottmforest', 'nottinghamforest')
  let refreshed = 0
  for (const record of records) {
    const entry = manifest[record.player.id]
    if (!entry?.source.includes('/premierleague/photos/')) continue
    const code = entry.source.match(/\/p(\d+)\.png$/)?.[1]
    const candidate = candidates.get(code)
    if (!candidate || candidate.birth_date !== record.player.dateOfBirth) continue
    const team = teams.get(candidate.team)
    const sourceTeam = teamKey(team.name)
    const sameTeam = [record.team.name, record.team.shortName].some(name => {
      const target = teamKey(name)
      return sourceTeam === target || (Math.min(sourceTeam.length, target.length) >= 6 && (sourceTeam.includes(target) || target.includes(sourceTeam)))
    })
    if (!sameTeam) {
      try {
        const groups = await getJson(`https://www.fotmob.com/api/data/search/suggest?term=${encodeURIComponent(record.player.name)}&lang=en`)
        const suggestions = groups.flatMap(group => group.suggestions || []).filter(player => player.type === 'player' && !player.isCoach)
        const matches = [...new Map(suggestions.map(player => [player.id, player])).values()]
        for (const player of matches) {
          const profile = await getJson(`https://www.fotmob.com/api/data/playerData?id=${player.id}`)
          const club = teamKey(profile.primaryTeam?.teamName || '')
          const matchingClub = [record.team.name, record.team.shortName].some(name => teamKey(name) === club)
          if (profile.birthDate?.utcTime?.slice(0, 10) !== record.player.dateOfBirth || !matchingClub) continue
          if (await savePhoto(record, `https://images.fotmob.com/image_resources/playerimages/${player.id}.png`, `${record.player.id}-current.webp`)) {
            refreshed++
            console.log(`Refreshed transferred player ${record.player.name}: ${record.team.shortName}`)
          }
          break
        }
      } catch (error) { console.error(`Transfer photo ${record.player.name}: ${error.message}`) }
      continue
    }
    try {
      const source = `https://resources.premierleague.com/premierleague25/photos/players/110x140/${code}.png`
      if (await savePhoto(record, source, `${record.player.id}-current.webp`)) {
        refreshed++
        console.log(`Refreshed ${record.player.name}: ${record.team.shortName}`)
      }
    } catch (error) { console.error(`Refresh ${record.player.name}: ${error.message}`) }
    await delay(150)
  }
  console.log(`Refreshed ${refreshed} current-club photos`)
}

if (process.argv.includes('--fotmob')) {
  const fotmobLeagues = { PD: 87, BL1: 54, SA: 55, FL1: 53, PL: 47 }
  const teamNamesMatch = (record, team) => {
    const clean = value => normalize(value.replace(/\b(FC|CF|AC|SC|SAD|04|1899|1\.)\b/gi, ''))
    const target = clean(team.name)
    return [record.team.name, record.team.shortName].some(name => {
      const value = clean(name)
      return value === target || (Math.min(value.length, target.length) >= 6 && (value.includes(target) || target.includes(value)))
    })
  }
  for (const [league, id] of Object.entries(fotmobLeagues)) {
    try {
      const data = await getJson(`https://www.fotmob.com/api/data/leagues?id=${id}`)
      const tables = data.table.flatMap(group => group.data?.table?.all || [])
      const teams = [...new Map(tables.map(team => [team.id, team])).values()]
      console.log(`FotMob ${league}: checking ${teams.length} teams`)
      for (const team of teams) {
        try {
          const roster = await getJson(`https://www.fotmob.com/api/data/teams?id=${team.id}`)
          const players = (roster.squad?.squad || []).filter(group => group.title !== 'coach').flatMap(group => group.members || [])
          let teamAdded = 0
          for (const candidate of players) {
            const matches = records.filter(record => {
              if (!record.player.dateOfBirth || record.player.dateOfBirth !== candidate.dateOfBirth) return false
              const sameName = normalize(record.player.name) === normalize(candidate.name)
              const targetWords = words(record.player.name)
              const candidateWords = words(candidate.name)
              const containsName = Math.min(targetWords.length, candidateWords.length) >= 2
                && (targetWords.every(word => candidateWords.includes(word)) || candidateWords.every(word => targetWords.includes(word)))
              return sameName || containsName || teamNamesMatch(record, team)
            })
            const unique = [...new Map(matches.map(record => [record.player.id, record])).values()]
            if (unique.length !== 1 || saved(unique[0])) continue
            try {
              const source = `https://images.fotmob.com/image_resources/playerimages/${candidate.id}.png`
              if (await savePhoto(unique[0], source)) {
                added++
                teamAdded++
              }
            } catch (error) { console.error(`FotMob ${candidate.name}: ${error.message}`) }
            await delay(100)
          }
          console.log(`FotMob ${league} ${team.name}: ${teamAdded} added; ${Object.keys(manifest).length} total`)
        } catch (error) { console.error(`FotMob ${team.name}: ${error.message}`) }
        await delay(250)
      }
    } catch (error) { console.error(`FotMob ${league}: ${error.message}`) }
  }
}

if (process.argv.includes('--sportsdb')) {
  const sportsLeagues = ['English_Premier_League', 'Spanish_La_Liga', 'German_Bundesliga', 'Italian_Serie_A', 'French_Ligue_1']
  let lastLookup = 0
  async function getSportsData(path) {
    await delay(Math.max(0, lastLookup + 2200 - Date.now()))
    lastLookup = Date.now()
    return getJson(`https://www.thesportsdb.com/api/v1/json/123/${path}`)
  }
  try {
    for (const league of sportsLeagues) {
      const data = await getSportsData(`search_all_teams.php?l=${league}`)
      for (const team of data.teams || []) {
        const roster = await getSportsData(`lookup_all_players.php?id=${encodeURIComponent(team.idTeam)}`)
        let teamAdded = 0
        for (const candidate of roster.player || []) {
          const names = [candidate.strPlayer, ...(candidate.strPlayerAlternate || '').split(';')].filter(Boolean).map(normalize)
          const matches = records.filter(record => names.includes(normalize(record.player.name))
            && record.player.dateOfBirth && record.player.dateOfBirth === candidate.dateBorn)
          const unique = [...new Map(matches.map(record => [record.player.id, record])).values()]
          if (unique.length !== 1 || saved(unique[0])) continue
          const sources = [candidate.strCutout, candidate.strRender, candidate.strThumb].filter(Boolean)
          if (!sources.length) continue
          try {
            if (await savePhoto(unique[0], sources)) {
              added++
              teamAdded++
            }
          } catch (error) { console.error(`SportsDB ${candidate.strPlayer}: ${error.message}`) }
          await delay(120)
        }
        console.log(`SportsDB ${team.strTeam}: ${teamAdded} photos added`)
      }
    }
  } catch (error) { console.error(`SportsDB bulk lookup stopped: ${error.message}`) }
}

if (process.argv.includes('--fotmob-search')) {
  const leagueOrder = ['PD', 'BL1', 'SA', 'FL1', 'PL']
  const missing = records.filter(record => !saved(record))
    .sort((a, b) => leagueOrder.indexOf(a.league) - leagueOrder.indexOf(b.league))
  console.log(`FotMob individual lookup: ${missing.length} missing players`)
  for (const record of missing) {
    try {
      const plain = record.player.name.normalize('NFD').replace(/\p{M}/gu, '')
      const nameParts = plain.split(/\s+/)
      const queries = new Set([plain, nameParts.at(-1), nameParts[0]])
      const checked = new Set()
      let found = false
      for (const query of queries) {
        const groups = await getJson(`https://www.fotmob.com/api/data/search/suggest?term=${encodeURIComponent(query)}&lang=en`)
        const suggestions = (Array.isArray(groups) ? groups : []).flatMap(group => group.suggestions || [])
          .filter(candidate => candidate.type === 'player' && !candidate.isCoach)
        const candidates = [...new Map(suggestions.map(candidate => [candidate.id, candidate])).values()]
        for (const candidate of candidates.slice(0, nameParts.length === 1 ? 10 : 5)) {
          if (checked.has(candidate.id)) continue
          checked.add(candidate.id)
          const targetWords = words(record.player.name)
          const candidateWords = words(candidate.name)
          const sameName = normalize(record.player.name) === normalize(candidate.name)
          const overlaps = targetWords.some(word => word.length >= 3 && candidateWords.includes(word))
          if (!sameName && !overlaps) continue
          const profile = await getJson(`https://www.fotmob.com/api/data/playerData?id=${candidate.id}`)
          const sameBirthday = record.player.dateOfBirth && profile.birthDate?.utcTime?.slice(0, 10) === record.player.dateOfBirth
          const sourceTeam = normalize(profile.primaryTeam?.teamName || candidate.teamName || '')
          const sameTeam = [record.team.name.replace(/\s+FC$/, ''), record.team.shortName].some(name => {
            const targetTeam = normalize(name)
            return sourceTeam === targetTeam || (Math.min(sourceTeam.length, targetTeam.length) >= 6
              && (sourceTeam.includes(targetTeam) || targetTeam.includes(sourceTeam)))
          })
          const uniqueName = records.filter(other => normalize(other.player.name) === normalize(record.player.name)).length === 1
          const uniqueTeamName = records.filter(other => other.team.id === record.team.id
            && words(other.player.name).some(word => word.length >= 4 && candidateWords.includes(word))).length === 1
          if (!sameBirthday && !(sameTeam && ((sameName && uniqueName) || (overlaps && uniqueTeamName)))) continue
          const source = `https://images.fotmob.com/image_resources/playerimages/${candidate.id}.png`
          if (await savePhoto(record, source)) {
            added++
            found = true
            console.log(`FotMob search ${record.league}: saved ${record.player.name}; ${Object.keys(manifest).length} total`)
          }
          break
        }
        if (found) break
        await delay(300)
      }
      if (!found) console.log(`No matching photo: ${record.league} ${record.player.name}`)
    } catch (error) { console.error(`Search ${record.player.name}: ${error.message}`) }
    await delay(300)
  }
}

if (process.argv.includes('--wiki')) {
  for (const record of records.filter(record => !saved(record))) {
    try {
      const parts = record.player.name.split(/\s+/)
      const aliases = { Kaiki: 'Kaiki Bruno', Patric: 'Patric (Spanish footballer)' }
      const titles = new Set([
        aliases[record.player.name], record.player.name,
        `${parts[0]} ${parts.at(-1)}`, parts.slice(-2).join(' '),
        `${record.player.name} (footballer)`,
      ].filter(Boolean))
      for (const title of titles) {
        let summary
        try {
          summary = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ', '_'))}`)
        } catch (error) {
          if (!error.message.startsWith('HTTP 404')) throw error
          continue
        }
        if (!summary.originalimage?.source || !summary.wikibase_item || !/footballer|soccer player|football player/i.test(summary.extract)) continue
        const data = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${summary.wikibase_item}.json`)
        const entity = data.entities[summary.wikibase_item]
        const birthday = entity.claims?.P569?.[0]?.mainsnak?.datavalue?.value?.time?.slice(1, 11)
        const aliases = [entity.labels?.en?.value, ...(entity.aliases?.en || []).map(alias => alias.value)].filter(Boolean)
        const sameName = aliases.some(name => normalize(name) === normalize(record.player.name))
        const sameClub = normalize(summary.extract).includes(normalize(record.team.shortName || record.team.name.replace(/\s+FC$/, '')))
        if (birthday !== record.player.dateOfBirth && !(sameName && sameClub)) continue
        const source = new URL(summary.originalimage.source)
        source.search = ''
        if (await savePhoto(record, source.href)) {
          manifest[record.player.id].attribution = summary.content_urls?.desktop?.page
          await saveManifest()
          console.log(`Wikimedia ${record.league}: saved ${record.player.name}`)
        }
        break
      }
    } catch (error) {
      console.error(`Wikimedia ${record.player.name}: ${error.message}`)
      if (error.message.startsWith('HTTP 429:')) break
    }
    await delay(400)
  }
}

for (const league of Object.keys(leagues)) {
  const squad = records.filter(record => record.league === league)
  console.log(`${league}: ${squad.filter(saved).length}/${squad.length} players have saved photos`)
}
console.log(`Finished: ${startingCount} -> ${Object.keys(manifest).length} saved photos`)

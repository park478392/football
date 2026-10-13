import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Run from the project root: node --env-file=.env.local scripts/download-player-photos.mjs
// Include the top five scorers and assist providers per league with --top=5.
const top = Number(process.argv.find(arg => arg.startsWith('--top='))?.split('=')[1] ?? 1)
if (!Number.isInteger(top) || top < 1 || top > 50) throw new Error('--top must be an integer from 1 to 50')
const key = process.env.FOOTBALL_DATA_KEY
if (!key) throw new Error('FOOTBALL_DATA_KEY is required')
const directory = resolve('public/players')
await mkdir(directory, { recursive: true })
const manifestPath = resolve(directory, 'manifest.json')
const manifest = existsSync(manifestPath)
  ? JSON.parse(await readFile(manifestPath, 'utf8')) : {}
async function get(url, headers = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${new URL(url).hostname}`)
  return response
}
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
    for (const { player, team } of leaders) {
      if (manifest[player.id] && existsSync(resolve('public', manifest[player.id].image.slice(1)))) {
        console.log(`Already saved: ${player.name}`)
        continue
      }
      try {
        const result = await (await get(`https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=${encodeURIComponent(player.name)}`)).json()
        const candidates = (result.player || []).filter(p => ['soccer', 'football'].includes(p.strSport?.toLowerCase()))
        const selected = candidates.find(p => {
          const name = p.strTeam?.toLowerCase()
          return name && (name.includes(team.name.toLowerCase()) || team.name.toLowerCase().includes(name))
        }) || candidates.find(p => p.strPlayer?.toLowerCase() === player.name.toLowerCase())
        const source = selected?.strCutout || selected?.strRender || selected?.strThumb
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

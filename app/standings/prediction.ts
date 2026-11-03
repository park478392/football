export type TeamStats = {
  team: { id: number }
  playedGames: number
  goalsFor: number
  goalsAgainst: number
}

function poisson(mean: number) {
  const probabilities = [Math.exp(-mean)]
  for (let goals = 1; goals <= 20; goals++) probabilities.push(probabilities[goals - 1] * mean / goals)
  return probabilities
}

// Shrink early-season rates toward the league mean using five prior games.
export function predictMatch(home: TeamStats, away: TeamStats, homeTable: TeamStats[], awayTable: TeamStats[], total: TeamStats[]) {
  if (![home, away].every((row) => row.playedGames > 0 && Number.isFinite(row.goalsFor) && Number.isFinite(row.goalsAgainst))) return null
  const games = total.reduce((sum, row) => sum + row.playedGames, 0)
  if (!games) return null
  const average = total.reduce((sum, row) => sum + row.goalsFor, 0) / games
  if (!Number.isFinite(average) || average <= 0) return null
  function rate(row: TeamStats, venue: TeamStats[], field: 'goalsFor' | 'goalsAgainst') {
    const split = venue.find((item) => item.team.id === row.team.id)
    const source = split && split.playedGames > 0 ? split : row
    return (source[field] + 5 * average) / (source.playedGames + 5)
  }
  const homeMean = Math.max(.15, Math.min(5, rate(home, homeTable, 'goalsFor') * rate(away, awayTable, 'goalsAgainst') / average))
  const awayMean = Math.max(.15, Math.min(5, rate(away, awayTable, 'goalsFor') * rate(home, homeTable, 'goalsAgainst') / average))
  const homeGoals = poisson(homeMean)
  const awayGoals = poisson(awayMean)
  const outcomes = [0, 0, 0]
  let best = -1
  let score = [0, 0]
  for (let h = 0; h < homeGoals.length; h++) {
    for (let a = 0; a < awayGoals.length; a++) {
      const probability = homeGoals[h] * awayGoals[a]
      outcomes[h > a ? 0 : h === a ? 1 : 2] += probability
      if (probability > best) { best = probability; score = [h, a] }
    }
  }
  const mass = outcomes.reduce((sum, value) => sum + value, 0)
  const raw = outcomes.map((value) => value / mass * 100)
  const percentages = raw.map(Math.floor)
  const order = raw.map((value, index) => ({ index, remainder: value - percentages[index] })).sort((a, b) => b.remainder - a.remainder)
  const remaining = 100 - percentages.reduce((sum, value) => sum + value, 0)
  for (let j = 0; j < remaining; j++) percentages[order[j].index]++
  return { percentages, score, homeMean, awayMean, venue: homeTable.some((row) => row.team.id === home.team.id && row.playedGames > 0) && awayTable.some((row) => row.team.id === away.team.id && row.playedGames > 0), sample: Math.min(home.playedGames, away.playedGames) }
}

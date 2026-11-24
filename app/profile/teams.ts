export const profileLeagues = [
  { code: 'PL', name: '프리미어리그' },
  { code: 'PD', name: '라리가' },
  { code: 'BL1', name: '분데스리가' },
  { code: 'SA', name: '세리에 A' },
  { code: 'FL1', name: '리그 1' },
] as const

export type ProfileLeague = (typeof profileLeagues)[number]['code']
export type Club = { id: number; name: string; shortName?: string; crest: string | null }
export type FavoriteTeam = { league: ProfileLeague; id: number; name: string; crest: string | null }
export type LeagueStandings = { standings: { type: string; table: { team: Club }[] }[] }

import { Player } from '../types';

export function rankPlayersByPenalty(players: Player[]) {
  return [...players].sort((a, b) => a.totalPenaltyVnd - b.totalPenaltyVnd);
}

export function getPlayerRank(players: Player[], playerId: string) {
  const sorted = rankPlayersByPenalty(players);
  const index = sorted.findIndex((player) => player.id === playerId);
  return index === -1 ? null : index + 1;
}

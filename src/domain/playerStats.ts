import { Player, Prediction, Settlement } from '../types';

export function applyPlayerStats(
  players: Player[],
  predictions: Prediction[],
  settlements: Settlement[]
): Player[] {
  return players.map((player) => {
    const playerPredictions = predictions.filter((prediction) => prediction.playerId === player.id);
    const playerSettlements = settlements.filter((settlement) => settlement.playerId === player.id);

    const hopeStarWins = playerSettlements.filter((settlement) => {
      if (settlement.status !== 'WIN' || settlement.penaltyVnd >= 0) return false;
      return playerPredictions.some((prediction) => prediction.id === settlement.predictionId && prediction.hopeStar);
    }).length;
    const rawLoseCount = playerSettlements.filter((settlement) => settlement.status === 'LOSE').length;

    return {
      ...player,
      totalPredictionsCount: playerPredictions.length,
      notLoseCount: playerSettlements.filter((settlement) => settlement.status === 'WIN').length,
      loseHalfCount: playerSettlements.filter((settlement) => settlement.status === 'LOSE_HALF').length,
      loseCount: Math.max(0, rawLoseCount - hopeStarWins),
      loseDoubleCount: playerSettlements.filter((settlement) => settlement.status === 'LOSE_DOUBLE').length,
      totalPenaltyVnd: Math.max(0, playerSettlements.reduce((total, settlement) => total + settlement.penaltyVnd, 0)),
    };
  });
}

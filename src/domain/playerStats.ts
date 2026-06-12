import { Player, Prediction, Settlement } from '../types';

export function applyPlayerStats(
  players: Player[],
  predictions: Prediction[],
  settlements: Settlement[]
): Player[] {
  return players.map((player) => {
    const playerPredictions = predictions.filter((prediction) => prediction.playerId === player.id);
    const playerSettlements = settlements.filter((settlement) => settlement.playerId === player.id);

    return {
      ...player,
      totalPredictionsCount: playerPredictions.length,
      notLoseCount: playerSettlements.filter((settlement) => settlement.status === 'WIN').length,
      loseHalfCount: playerSettlements.filter((settlement) => settlement.status === 'LOSE_HALF').length,
      loseCount: playerSettlements.filter((settlement) => settlement.status === 'LOSE').length,
      loseDoubleCount: playerSettlements.filter((settlement) => settlement.status === 'LOSE_DOUBLE').length,
      totalPenaltyVnd: playerSettlements.reduce((total, settlement) => total + settlement.penaltyVnd, 0),
    };
  });
}

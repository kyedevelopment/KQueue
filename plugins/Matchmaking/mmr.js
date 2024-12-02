const { QuickDB } = require('quick.db');
const db = new QuickDB();

class MMRSystem {
    static async initializePlayer(playerId, guildId) {
        const playerData = await db.get(`player_${guildId}_${playerId}`);
        if (!playerData) {
          await db.set(`player_${guildId}_${playerId}`, {
            mmr: 1000,
            wins: 0,
            losses: 0,
            gamesPlayed: 0,
            winrate: 'N/A',
            rank: 'N/A'
          });
        }
    }

  static async updateMMR(guildId, winners, losers) {
    const K_BASE = 100; 
    const GAMES_THRESHOLD = 10; 
  
    const winnerAvgMMR = await this.getAverageMMR(guildId, winners);
    const loserAvgMMR = await this.getAverageMMR(guildId, losers);
    const mmrDifference = winnerAvgMMR - loserAvgMMR;
  
    for (const winnerId of winners) {
      await this.initializePlayer(winnerId, guildId);
      const winnerData = await db.get(`player_${guildId}_${winnerId}`);
      const totalGames = winnerData.wins + winnerData.losses;
      const K = this.calculateK(K_BASE, totalGames, GAMES_THRESHOLD);
      
      const expectedScore = this.getExpectedScore(winnerAvgMMR, loserAvgMMR);
      const mmrGain = Math.round(K * (1 - expectedScore));
      
      const adjustedMmrGain = this.adjustMMRChange(mmrGain, mmrDifference);
  
      winnerData.mmr += adjustedMmrGain;
      winnerData.wins += 1;
      winnerData.gamesPlayed += 1;
      winnerData.winrate = this.calculateWinrate(winnerData.wins, winnerData.gamesPlayed);
      await db.set(`player_${guildId}_${winnerId}`, winnerData);
    }
  
    for (const loserId of losers) {
      await this.initializePlayer(loserId, guildId);
      const loserData = await db.get(`player_${guildId}_${loserId}`);
      const totalGames = loserData.wins + loserData.losses;
      const K = this.calculateK(K_BASE, totalGames, GAMES_THRESHOLD);
      
      const expectedScore = this.getExpectedScore(loserAvgMMR, winnerAvgMMR);
      const mmrLoss = Math.round(K * (0 - expectedScore));
      
      const adjustedMmrLoss = this.adjustMMRChange(mmrLoss, -mmrDifference);
  
      loserData.mmr += adjustedMmrLoss;
      loserData.losses += 1;
      loserData.gamesPlayed += 1;
      loserData.winrate = this.calculateWinrate(loserData.wins, loserData.gamesPlayed);
      await db.set(`player_${guildId}_${loserId}`, loserData);
    }
  }
  
  static calculateK(baseK, gamesPlayed, threshold) {
    return gamesPlayed <= threshold ? baseK : baseK * (threshold / gamesPlayed);
  }
  
  static adjustMMRChange(mmrChange, mmrDifference) {
    const adjustmentFactor = 1 + (mmrDifference / 400);
    return Math.round(mmrChange * adjustmentFactor);
  }

  static getExpectedScore(playerRating, opponentRating) {
    return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  }

  static async getAverageMMR(guildId, playerIds) {
  const ids = Array.isArray(playerIds) ? playerIds : [playerIds];
  let totalMMR = 0;
  let count = 0;

  for (const playerId of ids) {
    const playerData = await db.get(`player_${guildId}_${playerId}`);
    if (playerData && playerData.mmr) {
      totalMMR += playerData.mmr;
      count++;
    }
  }

  return count > 0 ? Math.round(totalMMR / count) : 0;
}

  static async getAllPlayers(guildId) {
    const allKeys = await db.all();
    const playerKeys = allKeys.filter(key => key.id.startsWith(`player_${guildId}_`));
    return Promise.all(playerKeys.map(async key => {
      const playerData = await db.get(key.id);
      return { id: key.id.split('_')[2], ...playerData };
    }));
  }

  static calculateWinrate(wins, gamesPlayed) {
    if (gamesPlayed === 0) return 'N/A';
    if (wins === gamesPlayed) return '100%';
    return Math.round((wins / gamesPlayed) * 100) + '%';
  }

  static async calculatePotentialMMRChange(guildId, team1, team2) {
    const team1Array = Array.isArray(team1) ? team1 : [team1];
    const team2Array = Array.isArray(team2) ? team2 : [team2];

    const team1AvgMMR = await this.getAverageMMR(guildId, team1Array);
    const team2AvgMMR = await this.getAverageMMR(guildId, team2Array);
  
    const potentialChanges = {
      team1: [],
      team2: []
    };
  
    for (const playerId of team1) {
      const playerData = await db.get(`player_${guildId}_${playerId}`);
      const totalGames = playerData.wins + playerData.losses;
      const K = this.calculateK(100, totalGames, 10);
      const expectedScore = this.getExpectedScore(team1AvgMMR, team2AvgMMR);
      const potentialGain = Math.round(K * (1 - expectedScore));
      potentialChanges.team1.push({ playerId, potentialGain });
    }
  
    for (const playerId of team2) {
      const playerData = await db.get(`player_${guildId}_${playerId}`);
      const totalGames = playerData.wins + playerData.losses;
      const K = this.calculateK(100, totalGames, 10);
      const expectedScore = this.getExpectedScore(team2AvgMMR, team1AvgMMR);
      const potentialGain = Math.round(K * (1 - expectedScore));
      potentialChanges.team2.push({ playerId, potentialGain });
    }
  
    return potentialChanges;
  }
}

module.exports = MMRSystem;
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Command } = require('../../../structures');
const { DefaultEmbed, ErrorEmbed } = require('../../../embeds');
const { QuickDB } = require('quick.db');
const db = new QuickDB();
const MMRSystem = require('../mmr');

const COOLDOWN = 120000; // 120 seconds cooldown
const cooldowns = new Map();

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'leaderboard',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Display the MMR leaderboard')
        .addIntegerOption(option => 
          option.setName('page')
            .setDescription('Page number of the leaderboard')
            .setRequired(false)),
    });
  }

  async execute(interaction) {
    const userId = interaction.user.id;
    const now = Date.now();
    const cooldownAmount = COOLDOWN;
    

    if (cooldowns.has(userId)) {
        const expirationTime = cooldowns.get(userId) + cooldownAmount;
  
        if (now < expirationTime) {
          const timeLeft = (expirationTime - now) / 1000;
          return interaction.reply({ 
            embeds: [new ErrorEmbed({ description: `Please wait ${timeLeft.toFixed(1)} more seconds before using this command again.` })],
            ephemeral: true 
          });
        }
    }

    cooldowns.set(userId, now);
    setTimeout(() => cooldowns.delete(userId), cooldownAmount);
    
    await interaction.deferReply();

    const page = interaction.options.getInteger('page') || 1;
    const playersPerPage = 10;

    const allPlayers = await this.getAllPlayers(interaction.guildId);
    const rankedPlayers = this.rankPlayers(allPlayers);

    const totalPages = Math.ceil(rankedPlayers.length / playersPerPage);
    const startIndex = (page - 1) * playersPerPage;
    const endIndex = startIndex + playersPerPage;
    const pagePlayers = rankedPlayers.slice(startIndex, endIndex);

    const leaderboardEmbed = new DefaultEmbed()
      .setTitle('MMR Leaderboard')
      .setDescription(this.formatLeaderboard(pagePlayers))
      .setFooter({ text: `Page ${page}/${totalPages}` });

    await interaction.editReply({ embeds: [leaderboardEmbed] });
  }

  async getAllPlayers(guildId) {
    const allKeys = await db.all();
    const playerKeys = allKeys.filter(key => key.id.startsWith(`player_${guildId}_`));
    return Promise.all(playerKeys.map(async key => {
      const playerData = await db.get(key.id);
      return { id: key.id.split('_')[2], ...playerData };
    }));
  }

  rankPlayers(players) {
    return players
      .filter(player => player.gamesPlayed > 0)
      .sort((a, b) => b.mmr - a.mmr)
      .map((player, index) => ({ ...player, rank: index + 1 }));
  }
  

  formatLeaderboard(players) {
    if (players.length === 0) {
      return 'No players on the leaderboard yet.';
    }
    const formattedPlayers = players.map(player => {
      const winrate = MMRSystem.calculateWinrate(player.wins, player.gamesPlayed);
      return `${player.rank}. <@${player.id}> - MMR: ${player.mmr} | W/L: ${player.wins}/${player.losses} | Winrate: ${winrate}`;
    });
    return formattedPlayers.join('\n') || 'No eligible players on the leaderboard.';
  }
};
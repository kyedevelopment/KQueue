const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { Command } = require('../../../structures');
const { DefaultEmbed, ErrorEmbed } = require('../../../embeds');
const { QuickDB } = require('quick.db');
const db = new QuickDB();
const MMRSystem = require('../mmr');
const { createCanvas, loadImage } = require('canvas');

const COOLDOWN = 60000; // 60 seconds cooldown
const cooldowns = new Map();

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'stats',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Display detailed player statistics')
        .addUserOption(option => 
          option.setName('player')
            .setDescription('The player to view stats for (leave empty for self)')
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

    const targetUser = interaction.options.getUser('player') || interaction.user;
    const playerData = await db.get(`player_${interaction.guildId}_${targetUser.id}`);

    if (!playerData) {
      return interaction.reply({ content: 'This player has no stats yet.', ephemeral: true });
    }

    const rank = await this.calculateRank(interaction.guildId, playerData.mmr);
    const winrate = MMRSystem.calculateWinrate(playerData.wins, playerData.gamesPlayed);

    const statsImage = await this.createStatsImage(targetUser, playerData, rank, winrate);
    const attachment = new AttachmentBuilder(statsImage, { name: 'stats.png' });
    const statsEmbed = new DefaultEmbed()
    .setTitle(`${targetUser.username}'s Stats`)
    .setImage('attachment://stats.png');

  await interaction.reply({ embeds: [statsEmbed], files: [attachment] });
}

async createStatsImage(user, playerData, rank, winrate) {
  const canvas = createCanvas(825, 600);
  const ctx = canvas.getContext('2d');



  return canvas.toBuffer();
}

getRankColor(rank) {
  switch (rank.toLowerCase()) {
    case 'bronze':
      return '#cd7f32';
    case 'copper':
      return '#b87333'; 
    case 'gold':
      return '#ffd700'; 
    case 'champ':
      return '#00bfff'; 
    case 'silver':
      return '#c0c0c0'; 
    case 'platinum':
      return '#e5e4e2'; 
    default:
      return '#4b4b4b'; 
  }
}

  async calculateRank(guildId, playerMMR) {
    const allPlayers = await MMRSystem.getAllPlayers(guildId);
    const rankedPlayers = allPlayers
      .filter(player => player.gamesPlayed > 0)
      .sort((a, b) => b.mmr - a.mmr);
    
    const playerRank = rankedPlayers.findIndex(player => player.mmr <= playerMMR) + 1;
    return playerRank > 0 ? `#${playerRank}` : 'N/A';
  }
};
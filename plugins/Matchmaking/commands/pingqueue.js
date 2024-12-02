const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Command } = require('../../../structures');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'pingqueue',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('pingqueue')
        .setDescription('Manually ping for queue players'),
    });
  }

  async execute(interaction) {
    if (!await this.checkStaffPermission(interaction, 'queue_ping')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const queueChannelId = await db.get(`channels_${interaction.guildId}.queue`);
    if (!queueChannelId) {
      return interaction.reply({ content: 'Queue channel not set up.', ephemeral: true });
    }

    const queue = await db.get(`queue_${interaction.guildId}`) || [];
    const playerCount = queue.reduce((count, item) => count + (typeof item === 'string' ? 1 : item.players.length), 0);
    const playersNeeded = 10 - playerCount;

    const queueChannel = await interaction.guild.channels.fetch(queueChannelId);
    const queueMessageId = await db.get(`queueMessage_${interaction.guildId}`);
    await this.deleteRecentMessages(queueChannel, queueMessageId);
    await queueChannel.send(`@here Need \`${playersNeeded}\` more for queue!`);

    await interaction.reply({ content: 'Queue ping sent successfully!', ephemeral: true });
  }

  async checkStaffPermission(interaction, requiredPermission) {
    const staffRoles = await db.get(`staffRoles_${interaction.guildId}`) || [];
    const userRoles = interaction.member.roles.cache;
    return staffRoles.some(staffRole => 
      userRoles.has(staffRole.id) && staffRole.permissions.includes(requiredPermission)
    ) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
  }

  async deleteRecentMessages(channel, queueMessageId) {
    const messages = await channel.messages.fetch({ limit: 10 });
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const recentMessages = messages.filter(msg => msg.id !== queueMessageId && msg.createdTimestamp > twoWeeksAgo);
    
    if (recentMessages.size > 0) {
      await channel.bulkDelete(recentMessages);
    }
  }
};

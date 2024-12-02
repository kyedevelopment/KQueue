const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Command } = require('../../../structures');
const { SuccessEmbed, ErrorEmbed, DefaultEmbed } = require('../../../embeds');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'clearqueue',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('clearqueue')
        .setDescription('Clear the current queue'),
    });
  }

  async execute(interaction) {
    if (!await this.checkStaffPermission(interaction, 'queue_clear')) {
      return interaction.reply({ embeds: [new ErrorEmbed({ description: 'You do not have permission to clear the queue.'})], ephemeral: true });
    }

    await db.set(`queue_${interaction.guildId}`, []);

    const queueChannelId = await db.get(`channels_${interaction.guildId}.queue`);
    if (queueChannelId) {
      const queueChannel = await interaction.guild.channels.fetch(queueChannelId);
      const queueMessageId = await db.get(`queueMessage_${interaction.guildId}`);
      if (queueMessageId) {
        try {
          const queueMessage = await queueChannel.messages.fetch(queueMessageId);
          await this.updateQueueEmbed(queueMessage, []);
        } catch (error) {
          console.error('Error updating queue message:', error);
        }
      }
    }

    await interaction.reply({ embeds: [new SuccessEmbed({ description: 'Queue has been cleared successfully.'})], ephemeral: true });
  }

  async checkStaffPermission(interaction, requiredPermission) {
    const staffRoles = await db.get(`staffRoles_${interaction.guildId}`) || [];
    const userRoles = interaction.member.roles.cache;
    return staffRoles.some(staffRole => 
      userRoles.has(staffRole.id) && staffRole.permissions.includes(requiredPermission)
    ) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
  }

  async updateQueueEmbed(message, queue) {
    const queueEmbed = new DefaultEmbed()
      .setTitle('Matchmaking Queue')
      .setDescription('Join the queue!')
      .addFields({ name: 'Queue', value: this.formatQueueInfo(queue) });

    await message.edit({ embeds: [queueEmbed] });
  }

  formatQueueInfo(queue) {
    const playerCount = queue.reduce((count, item) => count + (typeof item === 'string' ? 1 : item.players.length), 0);
    const playerList = queue.map(item => {
      if (typeof item === 'string') {
        return `<@${item}>`;
      } else {
        return `Team ${item.name}: ${item.players.map(id => `<@${id}>`).join(', ')}`;
      }
    }).join('\n');

    return `${playerCount}/10\n\n${playerList || 'No players in queue'}`;
  }
};

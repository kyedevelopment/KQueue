const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { Command } = require('../../../structures');
const { DefaultEmbed, ErrorEmbed, SuccessEmbed } = require('../../../embeds');
const { QuickDB } = require('quick.db');

const db = new QuickDB();

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'queue',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Manage the 5v5 queue system')
        //.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(subcommand =>
          subcommand
            .setName('send')
            .setDescription('Send the queue message to the designated channel')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('ban')
            .setDescription('Ban a user from joining the queue')
            .addUserOption(option => 
              option.setName('user')
                .setDescription('The user to ban from the queue')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('unban')
            .setDescription('Unban a user from the queue')
            .addUserOption(option => 
              option.setName('user')
                .setDescription('The user to unban from the queue')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('timeout')
            .setDescription('Set a timeout for a user from joining the queue')
            .addUserOption(option => 
              option.setName('user')
                .setDescription('The user to timeout from the queue')
                .setRequired(true)
            )
            .addIntegerOption(option =>
              option.setName('duration')
                .setDescription('Timeout duration in minutes')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('untimeout')
            .setDescription('Remove timeout for a user from the queue')
            .addUserOption(option => 
              option.setName('user')
                .setDescription('The user to remove timeout from the queue')
                .setRequired(true)
            )
        ),
    });
  }

  async checkStaffPermission(interaction, requiredPermission) {
    const staffRoles = await db.get(`staffRoles_${interaction.guildId}`) || [];
    const userRoles = interaction.member.roles.cache;
    return staffRoles.some(staffRole => 
      userRoles.has(staffRole.id) && staffRole.permissions.includes(requiredPermission)
    ) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
  }

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    let requiredPermission;
  
    switch (subcommand) {
      case 'send':
        requiredPermission = 'queue_send';
        break;
      case 'ban':
      case 'unban':
        requiredPermission = 'queue_ban';
        break;
      case 'timeout':
      case 'untimeout':
        requiredPermission = 'queue_timeout';
        break;
    }
  
    if (!await this.checkStaffPermission(interaction, requiredPermission)) {
      return interaction.reply({ embeds: [new ErrorEmbed({ description: 'You do not have permission to use this command.' })], ephemeral: true });
    }
  
    switch (subcommand) {
      case 'send':
        await this.sendQueueMessage(interaction);
        break;
      case 'ban':
        await this.banUserFromQueue(interaction);
        break;
      case 'unban':
        await this.unbanUserFromQueue(interaction);
        break;
      case 'timeout':
        await this.timeoutUserFromQueue(interaction);
        break;
      case 'untimeout':
        await this.untimeoutUserFromQueue(interaction);
        break;
    }
  }

  async sendQueueMessage(interaction) {
    const queueChannelId = await db.get(`channels_${interaction.guildId}.queue`);
    if (!queueChannelId) {
      return interaction.reply({ embeds: [new ErrorEmbed({ description: 'Queue channel has not been set up. Please use the setup command first.' })], ephemeral: true });
    }

    const queueChannel = await interaction.guild.channels.fetch(queueChannelId);
    if (!queueChannel) {
      return interaction.reply({ embeds: [new ErrorEmbed({ description: 'Queue channel not found. Please check the setup and try again.' })], ephemeral: true });
    }

    const existingMessageId = await db.get(`queueMessage_${interaction.guildId}`);
    if (existingMessageId) {
      try {
        const existingMessage = await queueChannel.messages.fetch(existingMessageId);
        if (existingMessage) {
          return interaction.reply({ embeds: [new ErrorEmbed({ description: 'A queue is already open in the designated channel.' })], ephemeral: true });
        }
      } catch (error) {
        console.log('Existing queue message not found. Creating a new one.');
      }
    }

    const queueEmbed = new DefaultEmbed()
      .setTitle('Matchmaking Queue')
      .setDescription('Join the queue!')
      .addFields({ name: 'Queue', value: '0/10' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('join_queue')
          .setLabel('Join Queue')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('leave_queue')
          .setLabel('Leave Queue')
          .setStyle(ButtonStyle.Danger)
      );

    const message = await queueChannel.send({ embeds: [queueEmbed], components: [row] });

    await db.set(`queueMessage_${interaction.guildId}`, message.id);

    await interaction.reply({ embeds: [new SuccessEmbed({ description: 'Queue system set up successfully in the designated channel!' })], ephemeral: true });
  }

  async banUserFromQueue(interaction) {
    const user = interaction.options.getUser('user');
    await db.set(`queueBan_${interaction.guildId}_${user.id}`, true);
    await interaction.reply({ embeds: [new SuccessEmbed({ description: `${user.tag} has been banned from joining the queue.` })], ephemeral: true });
  }

  async timeoutUserFromQueue(interaction) {
    const user = interaction.options.getUser('user');
    const duration = interaction.options.getInteger('duration');
    const timeoutUntil = Date.now() + duration * 60000;
    await db.set(`queueTimeout_${interaction.guildId}_${user.id}`, timeoutUntil);
    await interaction.reply({ embeds: [new SuccessEmbed({ description: `${user.tag} has been timed out from joining the queue for ${duration} minutes.` })], ephemeral: true });
  }

  async unbanUserFromQueue(interaction) {
    const user = interaction.options.getUser('user');
    await db.delete(`queueBan_${interaction.guildId}_${user.id}`);
    await interaction.reply({ embeds: [new SuccessEmbed({ description: `${user.tag} has been unbanned from the queue.` })], ephemeral: true });
  }

  async untimeoutUserFromQueue(interaction) {
    const user = interaction.options.getUser('user');
    await db.delete(`queueTimeout_${interaction.guildId}_${user.id}`);
    await interaction.reply({ embeds: [new SuccessEmbed({ description: `${user.tag}'s queue timeout has been removed.` })], ephemeral: true });
  }
};

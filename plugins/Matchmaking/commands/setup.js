const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { Command } = require('../../../structures');
const { DefaultEmbed, SuccessEmbed, ErrorEmbed } = require('../../../embeds');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'setup',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure bot settings for matchmaking')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
          subcommand
            .setName('channels')
            .setDescription('Set up results, logs, and queue channels')
            .addChannelOption(option => 
              option.setName('results_channel')
                .setDescription('Channel where game results will be posted')
                .setRequired(true))
            .addChannelOption(option => 
              option.setName('logs_channel')
                .setDescription('Channel where game logs will be posted')
                .setRequired(true))
            .addChannelOption(option => 
              option.setName('queue_channel')
                .setDescription('Channel for matchmaking queue')
                .setRequired(true)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('roles')
            .setDescription('Create custom roles with MMR thresholds')
            .addStringOption(option =>
              option.setName('role_name')
                .setDescription('Name of the role')
                .setRequired(true))
            .addRoleOption(option =>
              option.setName('role')
                .setDescription('The role to assign')
                .setRequired(true))
            .addIntegerOption(option =>
              option.setName('min_mmr')
                .setDescription('Minimum MMR for this role')
                .setRequired(true))
            .addIntegerOption(option =>
              option.setName('max_mmr')
                .setDescription('Maximum MMR for this role')
                .setRequired(true)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('staff')
            .setDescription('Define staff roles and their permissions')
            .addRoleOption(option =>
              option.setName('staff_role')
                .setDescription('The staff role to configure')
                .setRequired(true))
            .addStringOption(option =>
              option.setName('permissions')
                .setDescription('Select the permissions for this staff role')
                .setRequired(true)
                .addChoices(
                  { name: 'Clear Teams', value: 'clear-teams' },
                  { name: 'Queue Send', value: 'queue_send' },
                  { name: 'Queue Ban', value: 'queue_ban' },
                  { name: 'Queue Timeout', value: 'queue_timeout' },
                  { name: 'Ping Queue', value: 'queue_ping' },
                )))
        .addSubcommand(subcommand =>
          subcommand
            .setName('category')
            .setDescription('Set a custom category for queue channels')
            .addChannelOption(option => 
              option.setName('category')
                .setDescription('Select the category to create queue channels in')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true))) 
        .addSubcommand(subcommand =>
          subcommand
            .setName('display')
            .setDescription('Show the current setup information'))
    });
  }

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'channels':
        await this.setupChannels(interaction);
        break;
      case 'roles':
        await this.setupRoles(interaction);
        break;
      case 'staff':
        await this.setupStaff(interaction);
        break;
      case 'category':
        await this.setupCategory(interaction);
        break;
      case 'display':
        await this.displaySetup(interaction);
        break;
    }
  }

  async setupChannels(interaction) {
    const resultsChannel = interaction.options.getChannel('results_channel');
    const logsChannel = interaction.options.getChannel('logs_channel');
    const queueChannel = interaction.options.getChannel('queue_channel');

    await db.set(`channels_${interaction.guildId}`, {
      results: resultsChannel.id,
      logs: logsChannel.id,
      queue: queueChannel.id
    });

    await interaction.reply({ embeds: [new SuccessEmbed({ description: 'Channels setup completed successfully!' })] });
  }

  async setupRoles(interaction) {
    const roleName = interaction.options.getString('role_name');
    const role = interaction.options.getRole('role');
    const minMMR = interaction.options.getInteger('min_mmr');
    const maxMMR = interaction.options.getInteger('max_mmr');

    const roles = await db.get(`roles_${interaction.guildId}`) || [];
    roles.push({ name: roleName, id: role.id, minMMR, maxMMR });
    await db.set(`roles_${interaction.guildId}`, roles);

    await interaction.reply({ embeds: [new SuccessEmbed({ description: `Role "${roleName}" added successfully!` })] });
  }

  async setupStaff(interaction) {
    const staffRole = interaction.options.getRole('staff_role');
    const permissions = interaction.options.getString('permissions');

    const staffRoles = await db.get(`staffRoles_${interaction.guildId}`) || [];
    const existingRoleIndex = staffRoles.findIndex(role => role.id === staffRole.id);
    if (existingRoleIndex !== -1) {
      staffRoles[existingRoleIndex].permissions.push(permissions);
    } else {
      staffRoles.push({ id: staffRole.id, permissions: [permissions] });
    }
    await db.set(`staffRoles_${interaction.guildId}`, staffRoles);

    await interaction.reply({ embeds: [new SuccessEmbed({ description: `Staff role updated with ${permissions} permission successfully!` })] });
  }

  async setupCategory(interaction) {
    const category = interaction.options.getChannel('category');
    const guildId = interaction.guild.id;

    if (category && category.type === ChannelType.GuildCategory) {
      await db.set(`customCategory_${guildId}`, category.id);
      await db.set(`categoryEnabled_${guildId}`, true);
      await interaction.reply({ embeds: [new SuccessEmbed({ description: `Custom category set to ${category.name} for queue channels.` })] });
    } else {
      await db.set(`categoryEnabled_${guildId}`, false);
      await interaction.reply({ embeds: [new SuccessEmbed({ description: 'Reverted to the default category for queue channels.' })] });
    }
  }

  async displaySetup(interaction) {
    const channels = await db.get(`channels_${interaction.guildId}`);
    const roles = await db.get(`roles_${interaction.guildId}`);
    const staffRoles = await db.get(`staffRoles_${interaction.guildId}`);
    const customCategory = await db.get(`customCategory_${interaction.guildId}`);
    const categoryEnabled = await db.get(`categoryEnabled_${interaction.guildId}`);

    const embed = new DefaultEmbed()
      .setTitle('Current Setup')
      .addFields(
        { name: 'Channels', value: channels ? `Results: <#${channels.results}>\nLogs: <#${channels.logs}>\nQueue: <#${channels.queue}>` : 'Not set' },
        { name: 'Roles', value: roles ? roles.map(r => `${r.name}: <@&${r.id}> (MMR: ${r.minMMR}-${r.maxMMR})`).join('\n') : 'Not set' },
        { name: 'Staff Roles', value: staffRoles ? staffRoles.map(r => `<@&${r.id}>: ${r.permissions.join(', ')}`).join('\n') : 'Not set' },
        { name: 'Category', value: categoryEnabled ? `Custom Category: <#${customCategory}>` : 'Default Category' }
      );

    await interaction.reply({ embeds: [embed] });
  }
};

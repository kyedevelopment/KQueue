const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, PermissionsBitField } = require('discord.js');
const { Command } = require('../../../structures');
const { DefaultEmbed } = require('../../../embeds');

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'team-embed',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('team-embed')
        .setDescription('Send the team management embed')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    });
  }

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const embed = new DefaultEmbed()
      .setTitle('Team Management')
      .setDescription(`To manage partys use the buttons or use the following commands:

        • \`/party-create (party name)\`
        • \`/party-invite (discord user) (party name)\`
        • \`/party-leave (party name)\`
        • \`/party-disband (party name)\`
        
        Parties allow stacked players or teams to queue up together in 10-Mans without having to worry about the random selection of teammates and captains.`)
      .setThumbnail('')
      .setImage('')
      .setFooter({ text: 'Matchmaking TMS | dicsord.gg/' });

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_team')
          .setLabel('Create Team')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('invite_player')
          .setLabel('Invite Player')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('leave_team')
          .setLabel('Leave Team')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('list_teams')
          .setLabel('List My Teams')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.reply({ embeds: [embed], components: [buttons] });
  }
  
};
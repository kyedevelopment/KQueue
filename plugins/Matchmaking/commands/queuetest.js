const { SlashCommandBuilder } = require('discord.js');
const { Command } = require('../../../structures');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: 'queuetest',
      enabled: true,
      data: new SlashCommandBuilder()
        .setName('queuetest')
        .setDescription('Toggle test mode for the queue'),
    });
  }

  async execute(interaction) {
    if (interaction.user.id !== '' && interaction.user.id !== '') {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
  
    const testMode = await db.get(`queueTestMode_${interaction.guildId}`) || false;
    await db.set(`queueTestMode_${interaction.guildId}`, !testMode);
    
    const modeStatus = !testMode ? 'enabled' : 'disabled';
    const message = `Queue test mode ${modeStatus}. ${!testMode ? 'Duplicate entries are now allowed.' : 'Normal queue operation resumed.'}`;
  
    const queueChannelId = await db.get(`channels_${interaction.guildId}.queue`);
    if (queueChannelId) {
      const queueChannel = await interaction.guild.channels.fetch(queueChannelId);
      await queueChannel.send(message);
    }
  
    await interaction.reply({ content: `Test mode ${modeStatus}. Message sent to queue channel.`, ephemeral: true });
  }
};
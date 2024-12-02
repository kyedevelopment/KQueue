const { Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../../../config");
const { Event } = require("../../../structures/");
const { QuickDB } = require('quick.db');
const db = new QuickDB();
const { DefaultEmbed } = require('../../../embeds');

module.exports = class extends Event {
  constructor(client) {
    super(client, {
      name: "ready",
      enabled: true,
    });
  }
  async run() {
    await this.client.guilds.cache.each(async (guild) => {
      guild.commands.set(
        Array.from(this.client.commands.values()).map((r) => r.data.toJSON())
      );}
    )

    let userCount = 0;
    for (const guild of this.client.guilds.cache.values()) {
        userCount += guild.memberCount;
    }

    this.client.user.setPresence(config.presence);

    const queueCooldowns = new Map();

  this.client.on('messageCreate', async (message) => {
    if (!message.guild) return;

    const queueChannelId = await db.get(`channels_${message.guild.id}.queue`);
    if (message.channel.id !== queueChannelId) return;

    const now = Date.now();
    const cooldownAmount = 2000; // 5 seconds cooldown
    const lastUpdate = queueCooldowns.get(message.guild.id) || 0;

    if (now - lastUpdate < cooldownAmount) return;

    queueCooldowns.set(message.guild.id, now);

    const queue = await db.get(`queue_${message.guild.id}`) || [];
    const queueEmbed = await this.createQueueEmbed(message.channel, queue);

    const oldQueueMessageId = await db.get(`queueMessage_${message.guild.id}`);
    if (oldQueueMessageId) {
      try {
        const oldMessage = await message.channel.messages.fetch(oldQueueMessageId);
        await oldMessage.delete();
      } catch (error) {
        console.error('Error deleting old queue message:', error);
      }
    }

    await db.set(`queueMessage_${message.guild.id}`, queueEmbed.id);
  });

    console.log(`[BOT] ${this.client.user.username} is now ready.`);
  }

  async createQueueEmbed(channel, queue) {
    const queueEmbed = new DefaultEmbed()
      .setTitle('Matchmaking Queue')
      .setDescription('Join the queue!')
      .addFields({ name: 'Queue', value: this.formatQueueInfo(queue) });
  
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
  
    return await channel.send({ embeds: [queueEmbed], components: [row] });
  }

  formatQueueInfo(queue) {
    const playerCount = queue.reduce((count, item) => 
      count + (typeof item === 'object' ? item.players.length : 1), 0);
  
    const soloPlayers = [];
    const teams = [];
  
    queue.forEach(item => {
      if (typeof item === 'object') {
        teams.push(`Team ${item.name}: ${item.players.map(id => `<@${id}>`).join(', ')}`);
      } else {
        soloPlayers.push(`<@${item}>`);
      }
    });
  
    const playerList = [
      soloPlayers.join(', '),
      ...teams
    ].filter(Boolean).join('\n');
  
    return `${playerCount}/10\n\n${playerList || 'No players in queue'}`;
  }
};

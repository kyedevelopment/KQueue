const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { Event } = require('../../../structures');
const { DefaultEmbed } = require('../../../embeds');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

const MAPS = [
  { name: 'Bank', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272899843890610176/600px-Bank_Map_Card.png' },
  { name: 'Border', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272899886446149708/600px-R6S_map_border.png' },
  { name: 'Chalet', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272899918448558080/600px-R6S_map_chalet.png' },
  { name: 'Clubhouse', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272899945577316443/535px-R6S_map_clubhouse.png' },
  { name: 'Consulate', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272899989063995526/600px-R6S_map_consulate.png' },
  { name: 'Kafe', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272900016544944200/600px-Kafe_Dostoyevsky_R6S.png' },
  { name: 'Lair', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272900044705759274/533px-R6s_map_lair.png' },
  { name: 'Nighthaven', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272900076225957993/490px-R6S_map_Nighthaven_Labs.png' },
  { name: 'Skyscraper', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272900092634071140/535px-R6S_map_skyscraper.png' },
  { name: 'Oregon', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272900203401449506/600px-R6S_Map_Oregon_Rework.png' }
];

module.exports = class extends Event {
  constructor(client) {
    super(client, {
      name: 'mapSelection',
      enabled: true,
    });
  }

  async run(guild, team1, team2, textChannel) {
    const allPlayers = [...team1, ...team2];
    const votes = new Map();
    let timeLeft = 60; // 60 seconds for map selection

    const updateEmbed = () => {
      const mapList = MAPS.map((map, index) => {
        const voteCount = Array.from(votes.values()).filter(vote => vote === map.name).length;
        return `${index + 1}. ${map.name} - ${voteCount} votes`;
      }).join('\n');

      return new DefaultEmbed()
        .setTitle('Map Selection')
        .setDescription('Vote for the map you want to play on. Each player gets one vote.')
        .addFields({ name: 'Maps', value: mapList })
        .setFooter({ text: `Voting ends in ${timeLeft} seconds. Total votes: ${votes.size}/${allPlayers.length}` });
    };

    const buttons = [];
    for (let i = 0; i < Math.ceil(MAPS.length / 5); i++) {
      const actionRow = new ActionRowBuilder();
      for (let j = i * 5; j < Math.min((i + 1) * 5, MAPS.length); j++) {
        const map = MAPS[j];
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`vote_${j}`)
            .setLabel(`${j + 1}. ${map.name}`) 
            .setStyle(ButtonStyle.Primary)
        );
      }
      buttons.push(actionRow);
    }

    const message = await textChannel.send({ embeds: [updateEmbed()], components: buttons });

    const mapInterval = setInterval(async () => {
      timeLeft -= 5;
      if (timeLeft > 0) {
        await message.edit({ embeds: [updateEmbed()] });
      } else {
        clearInterval(mapInterval);
        await handleRandomMapSelection();
      }
    }, 5000);

    const collector = message.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async (interaction) => {
      if (!allPlayers.includes(interaction.user.id)) {
        await interaction.reply({ content: "You're not part of this match!", ephemeral: true });
        return;
      }

      const voteIndex = parseInt(interaction.customId.split('_')[1]);
      const votedMap = MAPS[voteIndex].name;

      votes.set(interaction.user.id, votedMap);

      await message.edit({ embeds: [updateEmbed()] });

      if (votes.size === allPlayers.length) {
        collector.stop('allVoted');
      }
    });

    collector.on('end', async () => {
      clearInterval(mapInterval); 
      if (votes.size === 0) {
        await handleRandomMapSelection();
      } else {
        const [selectedMap] = [...votes.entries()].reduce((a, b) => a[1] > b[1] ? a : b);
        const selectedMapData = MAPS.find(map => map.name === selectedMap);

        await this.handleMapSelection(guild, team1, team2, selectedMap, selectedMapData, textChannel);
      }
    });

    const handleRandomMapSelection = async () => {
      const randomMap = MAPS[Math.floor(Math.random() * MAPS.length)];
      await textChannel.send(`Time's up! The map is randomly selected: **${randomMap.name}**.`);
      await this.handleMapSelection(guild, team1, team2, randomMap.name, randomMap, textChannel);
    };
  }

  async handleMapSelection(guild, team1, team2, selectedMap, selectedMapData, textChannel) {
    const queueChannelId = await db.get(`queueChannel_${guild.id}`);
    const queueChannel = guild.channels.cache.get(queueChannelId);
    let category = queueChannel.parent; 

    const customCategoryEnabled = await db.get(`categoryEnabled_${guild.id}`);
    if (customCategoryEnabled) {
        const customCategoryId = await db.get(`customCategory_${guild.id}`);
        const customCategory = guild.channels.cache.get(customCategoryId);

        if (customCategory && customCategory.type === ChannelType.GuildCategory) {
            category = customCategory;
        }
    }

const queueNumber = await db.get(`queueCounter_${guild.id}`);
const oldVoiceChannelId = await db.get(`queueVoiceChannel_${guild.id}_${queueNumber}`);

    const [attackChannel, defenseChannel] = await Promise.all([
        guild.channels.create({
            name: `Attack(T1) - ${queueNumber}`,
            type: ChannelType.GuildVoice,
            parent: category, 
        }),
        guild.channels.create({
            name: `Defense(T2) - ${queueNumber}`,
            type: ChannelType.GuildVoice,
            parent: category,
        })
    ]);

    const oldVoiceChannel = guild.channels.cache.get(oldVoiceChannelId);

    for (const playerId of team1) {
        const member = await guild.members.fetch(playerId);
        if (member.voice && member.voice.channel === oldVoiceChannel) {
            await member.voice.setChannel(attackChannel);
        }
    }

    for (const playerId of team2) {
        const member = await guild.members.fetch(playerId);
        if (member.voice && member.voice.channel === oldVoiceChannel) {
            await member.voice.setChannel(defenseChannel);
        }
    }

    await oldVoiceChannel.delete();
    await db.delete(`queueVoiceChannel_${guild.id}_${queueNumber}`);

    this.client.emit('selectWinner', guild, team1, team2, selectedMap, textChannel);
}
};

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Event } = require('../../../structures');
const { DefaultEmbed } = require('../../../embeds');
const MMRSystem = require('../mmr');
const { QuickDB } = require('quick.db');
const db = new QuickDB();
//const discordTranscripts = require('discord-html-transcripts');

const MAPS = [
  { name: 'Bank', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272899843890610176/600px-Bank_Map_Card.png?ex=66bca7dc&is=66bb565c&hm=bcd863d658d3f0907eed1bad62c63a99f848a0b9011a24375da577d3dcaf0b9c&' },
  { name: 'Border', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272899886446149708/600px-R6S_map_border.png?ex=66bca7e6&is=66bb5666&hm=9a44e737a1b02d7e558cae2ce058f63a47c82d30cb25b511a2f87f476010246c&' },
  { name: 'Chalet', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272899918448558080/600px-R6S_map_chalet.png?ex=66bca7ed&is=66bb566d&hm=6fc6fd5df6504fbf828aa72000b36c6858b6400cd357d6d23baada1589c7c2b1&' },
  { name: 'Clubhouse', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272899945577316443/535px-R6S_map_clubhouse.png?ex=66bca7f4&is=66bb5674&hm=dbdc4b72912aa36175cbaff058d1f2812e81f16cb73394f516593d7c5c45dbad&' },
  { name: 'Consulate', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272899989063995526/600px-R6S_map_consulate.png?ex=66bca7fe&is=66bb567e&hm=c3434c8ef97d39a32d8daf1c80430a0be788763ae63fe7ab130da7845c41355c&' },
  { name: 'Kafe', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272900016544944200/600px-Kafe_Dostoyevsky_R6S.png?ex=66bca805&is=66bb5685&hm=877f3642d6d07cdc56c47a3ea2d61af612c0b156bbb2ad20dab516128bfd666d&' },
  { name: 'Lair', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272900044705759274/533px-R6s_map_lair.png?ex=66bca80b&is=66bb568b&hm=932c6da034addf8e2d873d6b13937367595336452fb34a09c9d573140a78d7b2&' },
  { name: 'Nighthaven', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272900076225957993/490px-R6S_map_Nighthaven_Labs.png?ex=66bca813&is=66bb5693&hm=1bf65d58d14d6875d63267eb28d872c41c8040d45a9b635ad7d3caed22e5c9b8&' },
  { name: 'Skyscraper', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272900092634071140/535px-R6S_map_skyscraper.png?ex=66bca817&is=66bb5697&hm=776801fbf138d179668b80983c532439ae0226f50004a494d9ba8c5291bb51c6&' },
  { name: 'Oregon', image: 'https://cdn.discordapp.com/attachments/1021961953717002290/1272900203401449506/600px-R6S_Map_Oregon_Rework.png?ex=66bca831&is=66bb56b1&hm=95e10c3a78579a8edd3a8d03caec34c5a28d04ef037b8fa2e31f64b96ebda311&' }
];

module.exports = class extends Event {
  constructor(client) {
    super(client, {
      name: 'selectWinner',
      enabled: true,
    });
  }

  async run(guild, team1, team2, selectedMap, textChannel) {
    const allPlayers = [...team1, ...team2];
    const votes = new Map();
    let team1Votes = 0;
    let team2Votes = 0;
    const queueNumber = await db.get(`queueCounter_${guild.id}`);

    const updateEmbed = () => {
      const team1List = team1.map(id => `<@${id}>${votes.get(id) ? ' (Voted)' : ''}`).join('\n');
      const team2List = team2.map(id => `<@${id}>${votes.get(id) ? ' (Voted)' : ''}`).join('\n');
      

      return new DefaultEmbed()
        .setTitle('⚔️ Select Winner ⚔️')
        .setDescription(`Map: ${selectedMap}`)
        .setThumbnail(MAPS.find(map => map.name === selectedMap).image)
        .addFields(
          { name: 'Team 1 (Attack)', value: team1List, inline: true },
          { name: 'Team 2 (Defense)', value: team2List, inline: true },
          { name: 'Votes', value: `Team 1: ${team1Votes} | Team 2: ${team2Votes}`, inline: false }
        )
        .setFooter({ text: `Total votes: ${votes.size}/${allPlayers.length}` });
    };

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('vote_team1')
          .setLabel('Team 1')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('vote_team2')
          .setLabel('Team 2')
          .setStyle(ButtonStyle.Primary)
      );

    const message = await textChannel.send({ 
      embeds: [updateEmbed()], 
      components: [buttons] 
    });

    const collector = message.createMessageComponentCollector();

    collector.on('collect', async (interaction) => {
      if (!allPlayers.includes(interaction.user.id)) {
        await interaction.reply({ content: "You're not part of this match!", ephemeral: true });
        return;
      }

      if (votes.has(interaction.user.id)) {
        await interaction.reply({ content: "You've already voted!", ephemeral: true });
        return;
      }

      const votedTeam = interaction.customId === 'vote_team1' ? 'Team 1' : 'Team 2';
      votes.set(interaction.user.id, votedTeam);

      if (votedTeam === 'Team 1') {
        team1Votes++;
      } else {
        team2Votes++;
      }

      await message.edit({ embeds: [updateEmbed()] });
      await interaction.reply({ content: `You voted for ${votedTeam}!`, ephemeral: true });

      if (team1Votes === 1 || team2Votes === 1) { //change to 6 when done
        collector.stop('winnerDecided');
      }
    });

    async function handleMatchEnd(guild, team1, team2, winner) {
      const winners = winner === 'Team 1' ? team1 : team2;
      const losers = winner === 'Team 1' ? team2 : team1;
      const queueNumber = await db.get(`queueCounter_${guild.id}`);
      const mmrChanges = await MMRSystem.updateMMR(guild.id, winners, losers);

      await saveMatchResults(guild.id, team1, team2, winner, mmrChanges);
    
      const resultsEmbed = createResultsEmbed(team1, team2, winner, mmrChanges, queueNumber);
      const resultsChannel = guild.channels.cache.get(await db.get(`resultsChannel_${guild.id}`));
      await resultsChannel.send({ embeds: [resultsEmbed] });
    
      const logEmbed = createLogEmbed(team1, team2, winner, mmrChanges, queueNumber, selectedMap);
      const logChannel = guild.channels.cache.get(await db.get(`logsChannel_${guild.id}`));
      await logChannel.send({ embeds: [logEmbed], components: [createLogButtons(queueNumber)] });
    }
    
    function createResultsEmbed(team1, team2, winner, mmrChanges, queueNumber) {

      const formatTeam = (team, teamName) => {
        return team.map(playerId => {
          if (mmrChanges && mmrChanges[playerId]) {
            const change = mmrChanges[playerId];
            const changeStr = change.change > 0 ? `+${change.change}` : `${change.change}`;
            return `<@${playerId}>: ${changeStr} (${change.newMMR})`;
          } else {
            return `<@${playerId}>: MMR Error`;
          }
        }).join('\n');
      };
      
      const embed = new DefaultEmbed()
        .setTitle(`🏆Results for Queue #${queueNumber}🏆`)
    
      embed.addFields(
        { name: 'Team 1', value: formatTeam(team1, 'Team 1'), inline: true },
        { name: 'Team 2', value: formatTeam(team2, 'Team 2'), inline: true }
      );
    
      return embed;
    }
    
    function createLogEmbed(team1, team2, winner, mmrChanges, queueNumber, selectedMap) {
      const embed = new DefaultEmbed()
        .setTitle(`Match Log: Queue #${queueNumber}`)
        .setDescription(`Map: ${selectedMap}\nWinner: ${winner}`)
        .addFields(
          { name: 'Team 1', value: formatTeamWithMMR(team1, mmrChanges) },
          { name: 'Team 2', value: formatTeamWithMMR(team2, mmrChanges) }
        );
    
      return embed;
    }

    function formatTeamWithMMR(team, mmrChanges) {
      return team.map(playerId => {
        if (mmrChanges && mmrChanges[playerId]) {
          const change = mmrChanges[playerId];
          const changeStr = change.change > 0 ? `+${change.change}` : `${change.change}`;
          return `<@${playerId}>: ${changeStr} (${change.newMMR})`;
        } else {
          return `<@${playerId}>: MMR data unavailable`;
        }
      }).join('\n');
    }
    
    function createLogButtons(queueNumber, currentWinner) {
      return new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`revert_${queueNumber}`)
            .setLabel('Revert/Cancel')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`team1_${queueNumber}`)
            .setLabel('Team 1')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentWinner === 'Team 1'),
          new ButtonBuilder()
            .setCustomId(`team2_${queueNumber}`)
            .setLabel('Team 2')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentWinner === 'Team 2')
        );
    }
    
    async function saveMatchResults(guildId, queueNumber, team1, team2, winner, mmrChanges, selectedMap) {
      const matchData = {
        queueNumber,
        team1,
        team2,
        winner,
        mmrChanges,
        selectedMap,
        timestamp: Date.now()
      };
    
      await db.set(`matchResults_${guildId}_${queueNumber}`, matchData);
    
      const allPlayers = [...team1, ...team2];
      for (const playerId of allPlayers) {
        if (/^\d+$/.test(playerId)) { 
          const playerData = await db.get(`player_${guildId}_${playerId}`) || { wins: 0, losses: 0, gamesPlayed: 0 };
          playerData.gamesPlayed++;
          if ((winner === 'Team 1' && team1.includes(playerId)) || (winner === 'Team 2' && team2.includes(playerId))) {
            playerData.wins++;
          } else {
            playerData.losses++;
          }
          playerData.winrate = MMRSystem.calculateWinrate(playerData.wins, playerData.gamesPlayed);
          await db.set(`player_${guildId}_${playerId}`, playerData);
        }
      }
    
      return matchData;
    }

    //async function createTranscript(channel, guild) {
    //  const transcript = await discordTranscripts.createTranscript(channel);
    //  const transcriptChannel = await guild.channels.cache.get('TRANSCRIPT_CHANNEL_ID');
    //  
    //  await transcriptChannel.send({
    //    content: `Transcript for queue ${channel.name}`,
    //    files: [transcript],
    //  });
    //}

    async function cleanupMatchChannels(guild, queueNumber) {
      const queueChannelId = await db.get(`queueChannel_${guild.id}_${queueNumber}`);
      const attackChannelId = await db.get(`attackChannel_${guild.id}_${queueNumber}`);
      const defenseChannelId = await db.get(`defenseChannel_${guild.id}_${queueNumber}`);
    
      const channelsToDelete = [queueChannelId, attackChannelId, defenseChannelId];
    
      for (const channelId of channelsToDelete) {
        if (channelId) {
          const channel = await guild.channels.fetch(channelId);
          if (channel) {
            await channel.delete();
          }
        }
      }

      //await createTranscript(queueTextChannel, guild);
    
      await db.delete(`queueChannel_${guild.id}_${queueNumber}`);
      await db.delete(`attackChannel_${guild.id}_${queueNumber}`);
      await db.delete(`defenseChannel_${guild.id}_${queueNumber}`);
    }

    collector.on('end', async (collected, reason) => {
      if (reason === 'winnerDecided') {
        const winner = team1Votes === 1 ? 'Team 1' : 'Team 2'; //change to 6 when done
        await handleMatchEnd(guild, team1, team2, winner);
        await cleanupMatchChannels(guild, queueNumber);
      }
    });
  }
};
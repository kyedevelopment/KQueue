const { ChannelType, PermissionsBitField } = require('discord.js');
const { Event } = require('../../../structures');
const { DefaultEmbed } = require('../../../embeds');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

module.exports = class extends Event {
    constructor(client) {
        super(client, {
            name: 'queueFilled',
            enabled: true,
        });
    }

    async run(guild, queue, largeTeams) {
        const queueMessageId = await db.get(`queueMessage_${guild.id}`);
        const queueChannelId = await db.get(`queueChannel_${guild.id}`);

        if (queueMessageId && queueChannelId) {
          const queueChannel = guild.channels.cache.get(queueChannelId);
          if (queueChannel) {
            try {
              const queueMessage = await queueChannel.messages.fetch(queueMessageId);
              const updatedEmbed = new DefaultEmbed()
                .setTitle('Matchmaking Queue')
                .setDescription('Join the queue!')
                .addFields({ name: 'Players', value: '0/10' });
            
              await queueMessage.edit({ embeds: [updatedEmbed] });
            } catch (error) {
              console.error('Error updating queue embed:', error);
            }
          }
        }


        try {
            const queueNumber = await db.get(`queueCounter_${guild.id}`) || 0;
            await db.set(`queueCounter_${guild.id}`, queueNumber + 1);
            await db.set(`matchState_${guild.id}_${queueNumber}`, 'queueFilled');

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

            const [textChannel, voiceChannel] = await Promise.all([
                guild.channels.create({
                    name: `queue-${queueNumber + 1}`,
                    type: ChannelType.GuildText,
                    parent: category,
                }),
                guild.channels.create({
                    name: `Queue ${queueNumber + 1}`,
                    type: ChannelType.GuildVoice,
                    parent: category,
                })
            ]);

            await db.set(`queueVoiceChannel_${guild.id}_${queueNumber + 1}`, voiceChannel.id);

            const channelPermissions = [
                {
                    id: guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                ...queue.map(id => ({
                    id: id,
                    allow: [PermissionsBitField.Flags.ViewChannel],
                })),
            ];

            await Promise.all([
                textChannel.permissionOverwrites.set(channelPermissions),
                voiceChannel.permissionOverwrites.set(channelPermissions)
            ]);

            const playerMentions = queue.map(id => `<@${id}>`).join(", ");
            const notificationEmbed = new DefaultEmbed()
                .setTitle("Matchmaking TM")
                .setDescription(`Please join the voice channel: ${voiceChannel.toString()}\n\nYou have 3 minutes to join before the match is cancelled.`);

            const notifyMessage = await textChannel.send({ content: `${playerMentions}`, embeds: [notificationEmbed] });

            await Promise.all(queue.map(async userId => {
                const member = await guild.members.fetch(userId);
                if (member.voice.channel) {
                    await member.voice.setChannel(voiceChannel);
                }
            }));

            await db.set(`queue_${guild.id}`, []);
            await this.client.emit('captainSelection', guild, queue, textChannel, voiceChannel, largeTeams);

        } catch (error) {
            console.error('Error in queueFilled event:', error);
        }
    }
};

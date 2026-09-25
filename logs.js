const { EmbedBuilder } = require('discord.js');

// ✅ LAHAT NG SUPPORTED IMAGE & VIDEO EXTENSIONS
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'tiff'];
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'avi', 'flv', 'wmv', 'mkv', 'mpeg', 'mpg', '3gp', 'm4v'];

module.exports = {
    async log(guild, config, title, description, color = '#7700ff') {
        if (!config.logsChannel) return;
        const channel = guild.channels.cache.get(config.logsChannel);
        if (!channel) return;
        const embed = new EmbedBuilder()
            .setColor('#7700ff')
            .setTitle(title)
            .setDescription(description)
            .setTimestamp();
        channel.send({ embeds: [embed] }).catch(console.error);
    },

    // ✅ MESSAGE DELETED — LAHAT NG IMAGE/VIDEO FORMAT KIKILALAIN NA!
    async logMessageDelete(message, config) {
        if (!config.logsChannel || !message.guild) return;
        const channel = message.guild.channels.cache.get(config.logsChannel);
        if (!channel) return;

        let mediaText = '';
        let imageUrl = null;

        // ✅ KUNIN ANG ATTACHMENTS (Lahat ng uri)
        message.attachments.forEach(att => {
            const fileName = att.name?.toLowerCase() || '';
            const ext = fileName.split('.').pop();

            // ✅ IMAGE — kabilang jpg, jpeg, gif, png, webp, atbp.
            if (IMAGE_EXT.includes(ext) || att.contentType?.startsWith('image/')) {
                if (!imageUrl) imageUrl = att.url; // Unang image → ilalagay sa embed
                mediaText += `\n🖼️ **Image:** [${att.name}](${att.url})`;
            }
            // ✅ VIDEO — kabilang mov, mp4, webm, atbp.
            else if (VIDEO_EXT.includes(ext) || att.contentType?.startsWith('video/')) {
                mediaText += `\n🎬 **Video:** [${att.name}](${att.url})`;
            }
            // ✅ IBA PANG FILE
            else {
                mediaText += `\n📁 **File:** [${att.name}](${att.url})`;
            }
        });

        // ✅ KUNIN ANG LINK NA NASA TEXT (halimbawa: .gif link)
        const urlRegex = /(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|mov|mp4|webm)[^\s]*)/gi;
        const foundUrls = message.content?.match(urlRegex) || [];
        for (const url of foundUrls) {
          if (!imageUrl && /\.(png|jpg|jpeg|gif|webp)/i.test(url)) {
              imageUrl = url;
          }
          mediaText += `\n🔗 **Media Link:** ${url}`;
        }

        const embed = new EmbedBuilder()
            .setColor('#7700ff')
            .setTitle('<a:editor:1539181508936343572> MESSAGE DELETED')
            .setDescription(`**Author:** ${message.author.tag} (${message.author.id})\n**Channel:** ${message.channel}\n\n**Content:**\n${message.content || '*No text content or only media*'}${mediaText}`)
            .setTimestamp();

        // ✅ Kung may litrato → ilalagay sa embed para makita agad
        if (imageUrl) embed.setImage(imageUrl);

        channel.send({ embeds: [embed] }).catch(() => {});
    },

    // ✅ MESSAGE EDITED
    async logMessageEdit(oldMsg, newMsg, config) {
        if (!config.logsChannel || !oldMsg.guild || oldMsg.content === newMsg.content) return;
        const channel = oldMsg.guild.channels.cache.get(config.logsChannel);
        if (!channel) return;
        const embed = new EmbedBuilder()
            .setColor('#7700ff')
            .setTitle('<a:editor:1539181508936343572> MESSAGE EDITED')
            .setDescription(`**Author:** ${oldMsg.author.tag} (${oldMsg.author.id})\n**Channel:** ${oldMsg.channel}\n\n**Before:**\n${oldMsg.content || '*No content*'}\n\n**After:** ${newMsg.content || '*No content*'}`)
            .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    },

    // ✅ REACTION REMOVED — AYOS NA (walang false log)
    async logReactionRemove(reaction, user, config) {
        if (!config.logsChannel || !reaction.message.guild) return;
        // ❌ Iwas false log
        if (reaction.partial || user.partial) return;
        if (reaction.message.author && reaction.message.author.id === reaction.message.client.user?.id) return;

        const channel = reaction.message.guild.channels.cache.get(config.logsChannel);
        if (!channel) return;

        const emojiName = reaction.emoji.animated 
            ? `<a:${reaction.emoji.name}:${reaction.emoji.id}> (Animated)` 
            : reaction.emoji.name || 'Unknown Emoji';

        const embed = new EmbedBuilder()
            .setColor('#7700ff')
            .setTitle('<a:editor:1539181508936343572> REACTION REMOVED')
            .setDescription(`**User:** ${user.tag} (${user.id})\n**Emoji:** ${emojiName}\n**Message Channel:** ${reaction.message.channel}`)
            .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    },

    // ✅ MEMBER JOINED
    async logMemberJoin(member, config) {
        if (!config.logsChannel) return;
        const channel = member.guild.channels.cache.get(config.logsChannel);
        if (!channel) return;
        const embed = new EmbedBuilder()
            .setColor('#7700ff')
            .setTitle('<a:editor:1539181508936343572> MEMBER JOINED')
            .setDescription(`**Member:** ${member.user.tag} (${member.id})\n**Account Created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
            .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    },

    // ✅ MEMBER LEFT / REMOVED
    async logMemberLeave(member, config, executor = null) {
        if (!config.logsChannel) return;
        const channel = member.guild.channels.cache.get(config.logsChannel);
        if (!channel) return;
        const embed = new EmbedBuilder()
            .setColor('#7700ff')
            .setTitle('<a:editor:1539181508936343572> MEMBER LEFT')
            .setDescription(`**Member:** ${member.user.tag} (${member.id})\n${executor ? `**Removed By:** ${executor.tag} (${executor.id})` : '*Left voluntarily*'}`)
            .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    },

    // ✅ JOINED VOICE CHANNEL
    async logVoiceJoin(member, channel, config) {
        if (!config.logsChannel) return;
        const logChannel = member.guild.channels.cache.get(config.logsChannel);
        if (!logChannel) return;
        const embed = new EmbedBuilder()
            .setColor('#7700ff')
            .setTitle('<a:editor:1539181508936343572> JOINED VOICE CHANNEL')
            .setDescription(`**Member:** ${member.user.tag} (${member.id})\n**Channel:** ${channel.name}`)
            .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    },

    // ✅ LEFT VOICE CHANNEL
    async logVoiceLeave(member, channel, config) {
        if (!config.logsChannel) return;
        const logChannel = member.guild.channels.cache.get(config.logsChannel);
        if (!logChannel) return;
        const embed = new EmbedBuilder()
            .setColor('#7700ff')
            .setTitle('<a:editor:1539181508936343572> LEFT VOICE CHANNEL')
            .setDescription(`**Member:** ${member.user.tag} (${member.id})\n**Channel:** ${channel.name}`)
            .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    },

    // ✅ ROLE CREATED
    async logRoleCreate(role, executor, config) {
        if (!config.logsChannel) return;
        const channel = role.guild.channels.cache.get(config.logsChannel);
        if (!channel) return;
        const embed = new EmbedBuilder()
            .setColor('#7700ff')
            .setTitle('<a:editor:1539181508936343572> ROLE CREATED')
            .setDescription(`**Created By:** ${executor.tag} (${executor.id})\n**Role Name:** ${role.name}\n**Role ID:** ${role.id}`)
            .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    },

    // ✅ ROLE DELETED
    async logRoleDelete(role, executor, config) {
        if (!config.logsChannel) return;
        const channel = role.guild.channels.cache.get(config.logsChannel);
        if (!channel) return;
        const embed = new EmbedBuilder()
            .setColor('#7700ff')
            .setTitle('<a:editor:1539181508936343572> ROLE DELETED')
            .setDescription(`**Deleted By:** ${executor.tag} (${executor.id})\n**Role Name:** ${role.name}\n**Role ID:** ${role.id}`)
            .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    },

    // ✅ ROLE GIVEN / ADDED
    async logRoleAdd(member, role, executor, config) {
        if (!config.logsChannel) return;
        const channel = member.guild.channels.cache.get(config.logsChannel);
        if (!channel) return;
        const embed = new EmbedBuilder()
            .setColor('#b700ff')
            .setTitle('<a:editor:1539181508936343572> ROLE GIVEN')
            .setDescription(`**Given By:** ${executor.tag} (${executor.id})\n**To:** ${member.user.tag} (${member.id})\n**Role:** ${role.name}`)
            .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    },

    // ✅ TIMEOUT ISSUED
    async logTimeout(member, duration, reason, executor, config) {
        if (!config.logsChannel) return;
        const channel = member.guild.channels.cache.get(config.logsChannel);
        if (!channel) return;
        const embed = new EmbedBuilder()
            .setColor('#b700ff')
            .setTitle('<a:editor:1539181508936343572> MEMBER TIMEOUT')
            .setDescription(`**Issued By:** ${executor.tag} (${executor.id})\n**Target:** ${member.user.tag} (${member.id})\n**Duration:** ${duration}\n**Reason:** ${reason || '*No reason provided*'}`)
            .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    }
};
const { EmbedBuilder } = require('discord.js');
const afkUsers = new Map();
const inviteWarnings = new Map();
const cooldownUsers = new Map();
const INVITE_REGEX = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[^\s<>"{}|\\^`\[\]]+/gi;
const WARNING_EMOJI = '<a:Warning:1546685072227442708>';
const COOLDOWN_SEC = 10;
const AFK_EMOJI = '<a:Afk:1546680393602699274>';
const EMBED_COLOR = '#FFFFFF';

// ✅ Format time para sa Welcome back message
function formatAfkTime(startMs) {
    const diff = Math.floor((Date.now() - startMs) / 1000);
    if (diff < 0) return '0 seconds';
    const w = Math.floor(diff / 604800);
    const d = Math.floor((diff % 604800) / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    const parts = [];
    if (w > 0) parts.push(`${w} week${w !== 1 ? 's' : ''}`);
    if (d > 0) parts.push(`${d} day${d !== 1 ? 's' : ''}`);
    if (h > 0) parts.push(`${h} hour${h !== 1 ? 's' : ''}`);
    if (m > 0) parts.push(`${m} minute${m !== 1 ? 's' : ''}`);
    parts.push(`${s} second${s !== 1 ? 's' : ''}`);
    return parts.join(', ');
}

// ✅ FULL embed — status + reason lang (WALANG time)
function makeFullEmbed(userLike, reason) {
    const avatar = userLike.avatarURL
        ? userLike.avatarURL
        : userLike.displayAvatarURL({ dynamic: true, size: 512 });

    return new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setThumbnail(avatar)
        .addFields(
            { name: '**status**', value: AFK_EMOJI, inline: false },
            { name: '**reason**', value: reason, inline: false }
        )
        .setTimestamp();
}

// ✅ STATUS ONLY embed — para sa mention notification
function makeStatusEmbed(userLike) {
    const avatar = userLike.avatarURL
        ? userLike.avatarURL
        : userLike.displayAvatarURL({ dynamic: true, size: 512 });

    return new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setThumbnail(avatar)
        .addFields(
            { name: '**status**', value: AFK_EMOJI, inline: false }
        )
        .setTimestamp();
}

async function stopAfk(message, userId) {
    const data = afkUsers.get(userId);
    if (!data) return;

    // ✅ DELETE IMMEDIATELY to prevent duplicate "Welcome back" messages
    afkUsers.delete(userId);

    try {
        const channel = message.guild.channels.cache.get(data.channelId);
        if (channel) {
            const oldMsg = await channel.messages
                .fetch(data.messageId)
                .catch(() => null);
            if (oldMsg) await oldMsg.delete().catch(() => {});
        }
    } catch {}

    const afkDuration = formatAfkTime(data.afkSince);
    await message.channel.send(
        `Welcome back ${message.author.username}, afk time: **${afkDuration}**`
    );
}

async function checkMentionedAfk(message) {
    if (message.author.bot) return;

    const mentionedUsers = message.mentions.users;
    let repliedUserId = null;

    if (message.reference?.messageId) {
        try {
            const repliedMsg = await message.channel.messages.fetch(
                message.reference.messageId
            );
            if (repliedMsg?.author) {
                repliedUserId = repliedMsg.author.id;
            }
        } catch {}
    }

    const afkToNotify = new Set();

    for (const [uid] of mentionedUsers) {
        if (afkUsers.has(uid)) afkToNotify.add(uid);
    }

    if (repliedUserId && afkUsers.has(repliedUserId)) {
        afkToNotify.add(repliedUserId);
    }

    for (const uid of afkToNotify) {
        const data = afkUsers.get(uid);
        if (!data) continue;

        // ✅ STATUS ONLY — walang reason, walang time
        const notifyEmbed = makeStatusEmbed(data);
        await message.channel.send({ embeds: [notifyEmbed] });
    }
}

async function handleAfkCommand(message, client) {
    const userId = message.author.id;
    const reason = message.content.slice(5).trim() || 'none';
    const now = Date.now();
    const cooldownEnd = cooldownUsers.get(userId) || 0;

    if (now < cooldownEnd) {
        await message.delete().catch(() => {});
        return;
    }

    if (INVITE_REGEX.test(reason)) {
        message.delete().catch(() => {});
        const warns = (inviteWarnings.get(userId) || 0) + 1;
        inviteWarnings.set(userId, warns);
        cooldownUsers.set(userId, now + COOLDOWN_SEC * 1000);

        if (warns >= 3) {
            try {
                await message.member.timeout(
                    10 * 60 * 1000,
                    '❌ 3rd Discord Invite Link in AFK — Auto-Timeout'
                );
            } catch (e) {
                console.error('[AFK Invite] Timeout failed:', e.message);
            }
            inviteWarnings.delete(userId);
        }

        const warnMsg =
            warns >= 3
                ? `${WARNING_EMOJI} ${message.author}, no discord invite link here ⛔ **3 warnings reached → 10 minutes TIMEOUT punishment**`
                : `${WARNING_EMOJI} ${message.author}, no discord invite link here ⚠️ **${warns}/3 warnings** — 3rd warning will result in 10 minutes of timeout punishment`;

        await message.channel.send(warnMsg);
        return;
    }

    if (afkUsers.has(userId)) {
        const oldData = afkUsers.get(userId);
        try {
            const ch = message.guild.channels.cache.get(oldData.channelId);
            if (ch) {
                const oldMsg = await ch.messages
                    .fetch(oldData.messageId)
                    .catch(() => null);
                if (oldMsg) await oldMsg.delete().catch(() => {});
            }
        } catch {}
    }

    const startMs = Date.now();
    const embed = makeFullEmbed(
        {
            avatarURL: message.author.displayAvatarURL({
                dynamic: true,
                size: 512,
            }),
        },
        reason
    );

    const sentMsg = await message.channel.send({ embeds: [embed] });

    afkUsers.set(userId, {
        afkSince: startMs,
        channelId: message.channel.id,
        messageId: sentMsg.id,
        avatarURL: message.author.displayAvatarURL({
            dynamic: true,
            size: 512,
        }),
    });
}

async function handleMessageCheck(message) {
    if (message.author.bot) return;

    const userId = message.author.id;

    // ✅ SKIP the ",afk" command itself
    if (message.content.toLowerCase().startsWith(',afk')) {
        return;
    }

    // ✅ CHECK AFK STATUS FIRST
    if (afkUsers.has(userId)) {
        await stopAfk(message, userId);
        return;
    }

    // Only check mentions if the user is not AFK
    await checkMentionedAfk(message);
}

module.exports = { handleAfkCommand, handleMessageCheck, afkUsers };
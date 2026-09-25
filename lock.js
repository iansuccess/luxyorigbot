const { PermissionFlagsBits } = require('discord.js');

const LOCK_EMOJI = '<a:Lock:1546693737680347166>';
const UNLOCK_EMOJI = '<a:lock:1546694330738024548>';

function canLock(member) {
    return member.permissions.has(PermissionFlagsBits.ManageChannels) ||
           member.permissions.has(PermissionFlagsBits.Administrator) ||
           member.guild.ownerId === member.id;
}

// ✅ @everyone LANG ANG BABAGUHIN — WALANG IBANG ROLE NA GALAWIN
async function lockChannel(channel) {
    try {
        // 🗑️ BURAHIN MUNA LAHAT NG KALAT NA NAGDAGDAG NG ROLE
        const overwrites = channel.permissionOverwrites.cache;
        for (const [id, ow] of overwrites) {
            if (ow.type === 'role' && id !== channel.guild.roles.everyone.id) {
                try {
                    await channel.permissionOverwrites.delete(id);
                } catch {}
            }
        }

        // 🔒 I-DENY SA @everyone LANG
        await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            SendMessages: false
        }, { reason: 'Channel locked' });
        return true;
    } catch (e) {
        console.error('[LOCK ERROR]', e.message);
        return false;
    }
}

// ✅ UNLOCK — BURAHIN LANG ANG LOCK SA @everyone
async function unlockChannel(channel) {
    try {
        await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            SendMessages: null
        }, { reason: 'Channel unlocked' });
        return true;
    } catch (e) {
        console.error('[UNLOCK ERROR]', e.message);
        return false;
    }
}

async function handleLockCommand(message) {
    if (!canLock(message.member)) return;

    const channel = message.channel;
    const cmd = message.content.trim().toLowerCase();

    if (cmd === ',lock') {
        const ok = await lockChannel(channel);
        if (ok) {
            await message.channel.send(`${LOCK_EMOJI} Channel locked by: ${message.author.username}`);
        }
    }
    else if (cmd === ',unlock') {
        const ok = await unlockChannel(channel);
        if (ok) {
            await message.channel.send(`${UNLOCK_EMOJI} Channel Unlocked by: ${message.author.username}`);
        }
    }
}

module.exports = { handleLockCommand };
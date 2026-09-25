const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const detection = require('./detection.js');
const BOT_OWNER_ID = '1531611262159687820';

module.exports = {
    name: 'role',
    description: 'Give or remove a role — ,role @User @Role',
    async execute(message, config) {
        // ✅ CHECK WHO CAN USE THE COMMAND
        const isServerOwner = message.author.id === message.guild.ownerId;
        const isBotOwner = message.author.id === BOT_OWNER_ID;
        const hasAdminPerm = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
        // ✅ ALLOW IF USER HAS MANAGE ROLES PERMISSION
        const hasManageRolesPerm = message.member.permissions.has(PermissionsBitField.Flags.ManageRoles);
        
        if (!isServerOwner && !isBotOwner && !hasAdminPerm && !hasManageRolesPerm) {
            return; // ❌ No permission — no reply
        }
        // ✅ GET MENTIONED USER AND ROLE
        const targetUser = message.mentions.members.first();
        const targetRole = message.mentions.roles.first();
        // ✅ DEBUG — check console output
        console.log(`[ROLE CMD] Used by: ${message.author.tag}`);
        console.log(`[ROLE CMD] Mentioned User: ${targetUser?.user.tag || 'Nothing'}`);
        console.log(`[ROLE CMD] Mentioned Role: ${targetRole?.name || 'Nothing'}`);
        // ❌ No user or role mentioned
        if (!targetUser || !targetRole) {
            return message.reply('<a:wrong1:1546809103702167642> **wrong format!**\nUse: `,role @User @Role`\nExample: `,role @Apollo @blazecity`');
        }
        // ⚠️ Check if bot can assign that role
        const botHighestRole = message.guild.members.me.roles.highest;
        if (targetRole.position >= botHighestRole.position) {
            return message.reply(`<a:wrong1:1546809103702167642> I can’t grant **${targetRole.name}** — it is higher than my highest role! Move my role to the top in Server Settings → Roles.`);
        }
        // ⚠️ Check if user can assign that role
        const userHighestRole = message.member.roles.highest;
        if (targetRole.position >= userHighestRole.position && !isServerOwner && !isBotOwner) {
            return message.reply(`<a:wrong1:1546809103702167642> This role is higher than yours — you cannot give it.`);
        }

        // ==========================================
        // 🚨 PROTECTION CHECK — ADMIN ROLE + NOT WHITELISTED
        // ==========================================
        const isAdminRole = targetRole.permissions.has(PermissionsBitField.Flags.Administrator);
        const executorWhitelisted = 
            detection.isWhitelisted(message.member, 'bypassGiveAdmin', config) || 
            detection.isWhitelisted(message.member, 'protection', config);

        if (isAdminRole && !executorWhitelisted && !isServerOwner && !isBotOwner && config?.protectionEnabled?.antiGiveAdmin) {
            console.log(`[ROLE CMD PROTECTION] ${message.author.tag} tried to give Admin role via command — CLEARING.`);

            // ✅ 1. REMOVE the admin role from target (kung naibigay na)
            try {
                detection.isBotActing = true;
                if (targetUser.roles.cache.has(targetRole.id)) {
                    await targetUser.roles.remove(targetRole, 'Unauthorized Administrator role assignment via ,role command');
                    console.log(`[ROLE CMD PROTECTION] ✅ Role ${targetRole.name} removed from ${targetUser.user.tag}`);
                }
            } catch (e) {
                console.log('[ROLE CMD PROTECTION] ⚠️ Failed to remove admin role:', e?.message);
            } finally {
                detection.isBotActing = false;
            }

            // ✅ 2. CLEAR roles of the executor
            await detection.clearMemberRoles(message.member, "Unauthorized attempt to grant Administrator privileges via ,role command");

            // ✅ 3. DM the Owner
            try {
                const owner = await message.client.users.fetch(message.guild.ownerId);
                if (owner) {
                    const alertEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🚨 AUTO-REMOVED: Admin Role Given via Command')
                        .setDescription(`**Nagbigay:** ${message.author.tag} (${message.author.id})\n**Binigyan:** ${targetUser.user.tag} (${targetUser.id})\n**Role:** ${targetRole.name}\n**Command:** \`,role\`\n\n<a:verify:1539238356003848344> **AUTO-REMOVED — Role taken back! Executor roles cleared!**`)
                        .setTimestamp();
                    await owner.send({ embeds: [alertEmbed] });
                }
            } catch (dmErr) {
                console.log('[ROLE CMD PROTECTION] ⚠️ Could not DM Owner:', dmErr.message);
            }

            // ✅ 4. Log sa logsChannel
            const logChannel = message.guild.channels.cache.get(config?.logsChannel);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#7700ff')
                    .setTitle('🚨 UNAUTHORIZED ADMIN ASSIGNMENT VIA COMMAND — AUTO REMOVED')
                    .setDescription(`**Executor:** ${message.author.tag} (${message.author.id})\n**Target:** ${targetUser.user.tag} (${targetUser.id})\n**Role Given:** ${targetRole.name}\n**Command:** \`,role\`\n\n<a:verify:1539238356003848344> **Action:** Role REMOVED from target. ALL roles CLEARED from executor.`)
                    .setTimestamp();
                logChannel.send({ embeds: [embed] }).catch(() => {});
            }

            // ✅ 5. Reply sa channel
            return message.reply(`<a:wrong1:1546809103702167642> **Not whitelisted!** Your roles have been cleared for trying to give **${targetRole.name}**.`);
        }
        // ==========================================

        // ✅ TOGGLE: Remove if has role | Add if not
        if (targetUser.roles.cache.has(targetRole.id)) {
            await targetUser.roles.remove(targetRole);
            return message.reply(`<a:verify:1539238356003848344> **role removed** — **${targetRole.name}** removed from **${targetUser.user.tag}**`);
        } else {
            await targetUser.roles.add(targetRole);
            return message.reply(`<a:verify:1539238356003848344> **role given** — **${targetRole.name}** granted to **${targetUser.user.tag}**`);
        }
    }
};
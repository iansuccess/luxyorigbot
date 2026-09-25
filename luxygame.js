const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { loadLevels, addXP, getLevel, getDailyBonus } = require('./level.js');

// === CONFIG ===
const DATA_PATH = path.join(__dirname, 'data', 'luxyEconomy.json');
const GRID_ROWS = 3;
const GRID_COLS = 3;
const TOTAL_BOMBS = 3;
const CLICK_COOLDOWN = 0; // 3 seconds
const CASH_EMOJI = '<:pay_zz_cash:1541409370682822756>';
const DIAMOND_EMOJI = '<a:Diamond:1539820644647047282>';
const BOMB_EMOJI = '💣';
const OWNER_IDS = ['1531611262159687820', '1437451567401009286'];
const EPHEMERAL = 64; // ✅ Ephemeral flag (replaces deprecated ephemeral: true)

// === PERSISTENT DATA — AUTOMATICALLY SAVED ===
let userBalances = {};
let activeGames = new Map(); // userId -> gameData
let clickCooldowns = new Map(); // userId -> timestamp
let processingUsers = new Set(); // ✅ PREVENT DUPLICATE BETS

// Load data on start
function loadBalances() {
    try {
        if (!fs.existsSync(path.dirname(DATA_PATH))) fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
        if (fs.existsSync(DATA_PATH)) {
            userBalances = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
        }
    } catch (e) {
        console.error('[ECONOMY LOAD]', e);
        userBalances = {};
    }
}

// Load ALL data on bot start
loadBalances();
loadLevels();

// Save data — called automatically
function saveBalances() {
    try {
        fs.writeFileSync(DATA_PATH, JSON.stringify(userBalances, null, 2));
    } catch (e) {
        console.error('[ECONOMY SAVE]', e);
    }
}

// Get user balance (START WITH 50,000)
function getBalance(userId) {
    return Number(userBalances[userId] || 50000);
}

// Update balance
function setBalance(userId, amount) {
    userBalances[userId] = Math.max(0, Number(amount));
    saveBalances();
}

// Add to balance
function addBalance(userId, amount) {
    setBalance(userId, getBalance(userId) + Number(amount));
}

// === MULTIPLIER SYSTEM ===
const MULTIPLIERS = {
    1: 1.00,
    2: 2.00,
    3: 3.50,
    4: 6.00,
    5: 12.00,
    6: 25.00 // + 100K bonus if perfect!
};

// === CREATE GAME GRID ===
function createGameGrid() {
    const total = GRID_ROWS * GRID_COLS;
    const bombPositions = new Set();
    while (bombPositions.size < TOTAL_BOMBS) {
        bombPositions.add(Math.floor(Math.random() * total));
    }
    return {
        bombPositions: [...bombPositions],
        revealed: [],
        betAmount: 0,
        clicks: 0,
        isDead: false,
        isCasheOut: false
    };
}

// === BUILD GAME EMBED ===
function buildGameEmbed(game, user, status = 'Playing') {
    const multiplier = MULTIPLIERS[Math.min(game.clicks, 6)] || 25.00;
    const winnings = Math.floor(game.betAmount * multiplier);

    // ✅ MALINIS NA GRID — ? BAGO I-CLICK
    let gridText = '';
    for (let i = 0; i < GRID_ROWS; i++) {
        let row = '';
        for (let j = 0; j < GRID_COLS; j++) {
            const idx = i * GRID_COLS + j;
            if (game.revealed.includes(idx)) {
                row += game.bombPositions.includes(idx) ? `${BOMB_EMOJI} ` : `${CASH_EMOJI} `;
            } else {
                row += '❓ '; // ✅ MALINIS NA TANDA
            }
        }
        gridText += row + '\n';
    }

    const nextWin = Math.floor(game.betAmount * (MULTIPLIERS[Math.min(game.clicks + 1, 6)] || 25.00));

    const embed = new EmbedBuilder()
        .setColor('#7700ff')
        .setTitle(`${DIAMOND_EMOJI} ${user.username} — ${status}`)
        .addFields(
            { name: 'Bet', value: `${CASH_EMOJI} ${game.betAmount.toLocaleString()}`, inline: true },
            { name: 'Cash Out', value: `${CASH_EMOJI} ${winnings.toLocaleString()} (${multiplier}x)`, inline: true },
            { name: 'Next', value: `${CASH_EMOJI} ${nextWin.toLocaleString()}`, inline: true }
        )
        .setDescription(gridText);

    if (game.clicks === 6 && !game.isDead && !game.isCasheOut) {
        embed.addFields({ name: '🎉 PERFECT BONUS', value: `${CASH_EMOJI} +100,000`, inline: false });
    }

    return embed;
}

// === BUILD BUTTONS ===
function buildGameButtons(game) {
    const rows = [];

    // ✅ GRID BUTTONS — GUMAMIT NG TEXT O EMOJI NA SIGURADONG GAGANA
    for (let i = 0; i < GRID_ROWS; i++) {
        const row = new ActionRowBuilder();
        for (let j = 0; j < GRID_COLS; j++) {
            const idx = i * GRID_COLS + j;
            const isRevealed = game.revealed.includes(idx);
            const isBomb = game.bombPositions.includes(idx);

            // ✅ Siguradong gagana — walang raw code lalabas
            let btnLabel = '❓';
            if (isRevealed) {
                btnLabel = isBomb ? '💣' : '💷';
            }

            const btn = new ButtonBuilder()
                .setCustomId(`mine:click:${idx}`)
                .setStyle(isRevealed ? (isBomb ? ButtonStyle.Danger : ButtonStyle.Success) : ButtonStyle.Secondary)
                .setLabel(btnLabel)
                .setDisabled(isRevealed || game.isDead || game.isCasheOut);
            row.addComponents(btn);
        }
        rows.push(row);
    }

    // ✅ CASH OUT BUTTON — WALANG CUSTOM EMOJI, TEXT NA LANG
    if (game.clicks > 0 && !game.isDead && !game.isCasheOut) {
        rows.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('mine:cashout')
                .setStyle(ButtonStyle.Primary)
                .setLabel('💰 Cash Out')
        ));
    }

    return rows;
}

// === SAFE INTERACTION HELPERS (PREVENT CRASH ON EXPIRED INTERACTIONS) ===
async function safeUpdate(interaction, options) {
    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(options);
        } else {
            await interaction.update(options);
        }
    } catch (e) {
        if (e.code === 10062 || e.code === 40060) {
            console.log('[MINES] Interaction expired/already acknowledged — ignored');
            return;
        }
        console.error('[MINES] safeUpdate error:', e.message);
    }
}

async function safeReply(interaction, options) {
    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(options);
        } else {
            await interaction.reply(options);
        }
    } catch (e) {
        if (e.code === 10062 || e.code === 40060) {
            console.log('[MINES] Interaction expired/already acknowledged — ignored');
            return;
        }
        console.error('[MINES] safeReply error:', e.message);
    }
}

async function safeFollowUp(interaction, options) {
    try {
        await interaction.followUp(options);
    } catch (e) {
        if (e.code === 10062 || e.code === 40060) {
            console.log('[MINES] Follow-up failed (expired) — ignored');
            return;
        }
        console.error('[MINES] safeFollowUp error:', e.message);
    }
}

// === EXPORT HANDLERS ===
module.exports = {
    loadBalances,

    // Handle Message Commands: ,cash ,mine ,mine all ,give
    async handleMessageCommand(message, config) {
        const content = message.content.trim();
        const userId = message.author.id;
        const args = content.split(/\s+/);
        const cmd = args[0].toLowerCase();

        // ✅ ,cash — FIRST COMMAND — GAGANA KAHIT SINO
        if (cmd === ',cash') {
            const balance = getBalance(userId).toLocaleString();
            const level = getLevel(userId);
            const bonus = getDailyBonus(level).toLocaleString();
            const bonusLine = level >= 20
                ? `${CASH_EMOJI} Daily Bonus: **${bonus}**`
                : `<a:lock:1541430009191866400> Reach Level 20 to unlock daily bonus! (${20 - level} levels left)`;

            const embed = new EmbedBuilder()
                .setColor('#7700ff')
                .setTitle(`${DIAMOND_EMOJI} Luxy Currency`)
                .setDescription(
                    `⤷ **User:** ${message.author}\n` +
                    `⤷ **Level:** ${level}\n\n` +
                    `${CASH_EMOJI} Currently Cash: **${balance}**!\n` +
                    `${bonusLine}`
                )
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true })); // ✅ Profile Picture

            return message.reply({ embeds: [embed] });
        }

        // ,mine [amount]
        if (cmd === ',mine') {
            // ✅ LOCK — HINDI NA MAKAKAPASOK ULIT HABANG PINROPROSESO
            if (processingUsers.has(userId)) {
                return message.reply('⚠️ Processing your bet... please wait!');
            }

            if (activeGames.has(userId)) {
                return message.reply('⚠️ You have an active game! Finish it or cash out first.');
            }

            let amount;
            // ✅ ,mine all
            if (args[1] && args[1].toLowerCase() === 'all') {
                amount = getBalance(userId);
                if (amount <= 0) return message.reply('⚠️ You have nothing to bet!');
                // ✅ LIMIT: HIGIT SA 250K → 250K LANG ANG ITATAYA
                amount = Math.min(amount, 250000);
            }
            // ✅ ,mine [halaga]
            else {
                amount = args[1] ? parseInt(args[1].replace(/,/g, '')) : null;
                if (!amount || isNaN(amount) || amount <= 0) {
                    return message.reply('⚠️ Usage: `,mine 5000` or `,mine all`');
                }
            }

            // ✅ UNANG CHECK — BAGO BAWASAN
            const currentBalance = getBalance(userId);
            if (amount > currentBalance) {
                return message.reply(`⚠️ You only have ${CASH_EMOJI} ${currentBalance.toLocaleString()}`);
            }

            // ✅ I-LOCK AGAD BAGO MAG-SAVE
            processingUsers.add(userId);

            try {
                // ✅ BAWAS → I-SAVE AGAD → BAGO LAHAT
                setBalance(userId, currentBalance - amount);

                // ✅ DOUBLE CHECK — PAGKATAPOS MAG-SAVE, TIGNAN ULIT
                const newBalance = getBalance(userId);
                if (newBalance < 0) {
                    // Kung may nalusot, ibalik agad
                    setBalance(userId, currentBalance);
                    return message.reply('⚠️ Bet rejected — insufficient balance detected.');
                }

                // ✅ CREATE GAME — PAGKASAVE NA LANG
                const game = createGameGrid();
                game.betAmount = amount;
                activeGames.set(userId, game);

                const embed = buildGameEmbed(game, message.author, 'Playing');
                const buttons = buildGameButtons(game);
                return message.reply({ embeds: [embed], components: buttons, allowedMentions: { repliedUsers: false } });

            } finally {
                // ✅ ALISIN ANG LOCK KAHIT ANO ANG MANGYARI
                processingUsers.delete(userId);
            }
        }

        // ✅ ,give — OWNER CAN GIVE TO SELF!
        if (cmd === ',give') {
            const targetUser = message.mentions.users.first();
            let amount = args[2] ? parseInt(args[2].replace(/,/g, '')) : null;

            if (!targetUser || !amount || isNaN(amount) || amount <= 0) {
                return message.reply('⚠️ Usage: `,give @User [amount]` — Example: `,give @User 5000`');
            }
            if (targetUser.bot) return message.reply('⚠️ Cannot give to bots.');

            // ✅ NORMAL USERS ONLY — BAWAL BIGYAN ANG SARILI
            if (targetUser.id === userId && !OWNER_IDS.includes(userId)) {
                return message.reply('⚠️ Cannot give to yourself.');
            }

            // ✅ OWNER — PWEDENG PWEDI! KAHIT SA SARILI!
            if (OWNER_IDS.includes(userId)) {
                addBalance(targetUser.id, amount);
                return message.reply(`${CASH_EMOJI} Gave **${amount.toLocaleString()}** to ${targetUser}`);
            }

            // Normal users: only what they have
            const userBalance = getBalance(userId);
            const giveAmount = Math.min(amount, userBalance);
            if (giveAmount <= 0) {
                return message.reply(`⚠️ You don't have enough ${CASH_EMOJI}`);
            }

            setBalance(userId, userBalance - giveAmount);
            addBalance(targetUser.id, giveAmount);
            return message.reply(`${CASH_EMOJI} Gave **${giveAmount.toLocaleString()}** to ${targetUser}`);
        }
    },

    // Handle Button Clicks
    async handleButtonInteraction(interaction, config) {
        if (!interaction.customId.startsWith('mine:')) return;

        try {
            const userId = interaction.user.id;
            const game = activeGames.get(userId);

            if (!game) {
                return safeReply(interaction, {
                    content: '⚠️ No active game! Start with `,mine [amount]`',
                    flags: EPHEMERAL
                });
            }

            // Cooldown check
            const now = Date.now();
            const lastClick = clickCooldowns.get(userId) || 0;
            if (now - lastClick < CLICK_COOLDOWN) {
                const wait = Math.ceil((CLICK_COOLDOWN - (now - lastClick)) / 1000);
                return safeReply(interaction, {
                    content: `⚠️ Wait **${wait}s** before clicking again!`,
                    flags: EPHEMERAL
                });
            }
            clickCooldowns.set(userId, now);

            const parts = interaction.customId.split(':');
            const action = parts[1];

            // === CASH OUT → WIN ===
            if (action === 'cashout') {
                const multiplier = MULTIPLIERS[Math.min(game.clicks, 6)] || 25.00;
                let payout = Math.floor(game.betAmount * multiplier);

                // Perfect bonus: 6 safe clicks = +100K
                if (game.clicks === 6) {
                    payout += 100000;
                }

                // ✅ IBALIK ANG TAYA + DAGDAG ANG PANALO
                const totalWinnings = game.betAmount + payout;
                addBalance(userId, totalWinnings);
                game.isCasheOut = true;
                activeGames.delete(userId);

                // +5 XP for winning
                const levelUpEmbedWin = addXP(userId, 5, interaction.user);

                const embed = buildGameEmbed(game, interaction.user, 'Cashed Out!');
                await safeUpdate(interaction, { embeds: [embed], components: [] });

                if (levelUpEmbedWin) {
                    await safeFollowUp(interaction, { embeds: [levelUpEmbedWin] });
                }
                return;
            }

            // === CLICK TILE ===
            if (action === 'click') {
                const idx = parseInt(parts[2]);
                if (game.revealed.includes(idx)) {
                    return safeReply(interaction, {
                        content: '⚠️ Already clicked!',
                        flags: EPHEMERAL
                    });
                }

                game.revealed.push(idx);

                // HIT BOMB → LOSE
                if (game.bombPositions.includes(idx)) {
                    game.isDead = true;
                    activeGames.delete(userId);

                    // +2 XP for losing
                    const levelUpEmbedLose = addXP(userId, 2, interaction.user);

                    const embed = buildGameEmbed(game, interaction.user, '💥 Hit a Bomb!');
                    await safeUpdate(interaction, { embeds: [embed], components: [] });

                    if (levelUpEmbedLose) {
                        await safeFollowUp(interaction, { embeds: [levelUpEmbedLose] });
                    }
                    return;
                }

                // SAFE → continue
                game.clicks++;

                // AUTO CASH OUT if 6 safe clicks
                if (game.clicks === 6) {
                    let payout = Math.floor(game.betAmount * 25.00) + 100000;
                    // ✅ IBALIK ANG TAYA + DAGDAG ANG PANALO
                    const totalWinnings = game.betAmount + payout;
                    addBalance(userId, totalWinnings);
                    game.isCasheOut = true;
                    activeGames.delete(userId);

                    // +5 XP for perfect win
                    const levelUpEmbedPerfect = addXP(userId, 5, interaction.user);

                    const embed = buildGameEmbed(game, interaction.user, '🎉 Perfect!');
                    await safeUpdate(interaction, { embeds: [embed], components: [] });

                    if (levelUpEmbedPerfect) {
                        await safeFollowUp(interaction, { embeds: [levelUpEmbedPerfect] });
                    }
                    return;
                }

                // Continue game
                const embed = buildGameEmbed(game, interaction.user, 'Playing');
                const buttons = buildGameButtons(game);
                await safeUpdate(interaction, { embeds: [embed], components: buttons });
            }

        } catch (err) {
            // ✅ FINAL SAFETY NET — HINDI NA MAG-CRASH ANG BOT
            if (err.code === 10062 || err.code === 40060) {
                console.log('[MINES] Interaction expired — ignored');
                return;
            }
            console.error('[MINES ERROR]', err);
        }
    }
};
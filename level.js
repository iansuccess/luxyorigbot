const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const DATA_PATH = path.join(__dirname, 'data', 'luxyLevels.json');

const DIAMOND_EMOJI = '<a:Diamond:1539820644647047282>';
const CASH_EMOJI = '<:pay_zz_cash:1541409370682822756>';
const MAX_BONUS_LEVEL = 100;
const BASE_BONUS = 10000;
const BONUS_PER_LEVEL = 1000;

let userLevels = {};

// Load data
function loadLevels() {
    try {
        if (!fs.existsSync(path.dirname(DATA_PATH))) fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
        if (fs.existsSync(DATA_PATH)) {
            userLevels = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
        }
    } catch (e) {
        console.error('[LEVEL LOAD]', e);
        userLevels = {};
    }
}

// Save data
function saveLevels() {
    fs.writeFileSync(DATA_PATH, JSON.stringify(userLevels, null, 2));
}

// Get user data
function getUserData(userId) {
    if (!userLevels[userId]) {
        userLevels[userId] = { xp: 0, level: 1 };
    }
    return userLevels[userId];
}

// Calculate required XP for level
function xpForLevel(level) {
    return level * 100;
}

// Get daily bonus based on level
function getDailyBonus(level) {
    if (level < 20) return 0;
    const effectiveLevel = Math.min(level, MAX_BONUS_LEVEL);
    return BASE_BONUS + ((effectiveLevel - 20) * BONUS_PER_LEVEL);
}

// Add XP and check level up — RETURNS level up embed if any
function addXP(userId, amount, user) {
    const data = getUserData(userId);
    const oldLevel = data.level;
    data.xp += amount;

    // Check level up
    while (data.xp >= xpForLevel(data.level + 1)) {
        data.level++;
    }

    saveLevels();

    // Return level up embed if level increased
    if (data.level > oldLevel) {
        const bonus = getDailyBonus(data.level);
        const bonusText = data.level >= 20 
            ? `${CASH_EMOJI} ⤷ ADDITIONAL **${bonus.toLocaleString()}** daily cash bonus!`
            : 'Keep playing to unlock daily bonus at Level 20!';

        const embed = new EmbedBuilder()
            .setColor('#7700ff')
            .setTitle(`${DIAMOND_EMOJI} ${user.username} LEVEL UP!`)
            .setDescription(`
⤷ **New Level:** **${data.level}**
${bonusText}
            `);
        return embed;
    }
    return null;
}

// Get level for cash embed
function getLevel(userId) {
    return getUserData(userId).level;
}

// Get XP progress for cash embed
function getXPProgress(userId) {
    const data = getUserData(userId);
    const needed = xpForLevel(data.level + 1);
    const current = data.xp - xpForLevel(data.level);
    const total = needed - xpForLevel(data.level);
    return { current, total, percent: Math.floor((current / total) * 100) };
}

module.exports = {
    loadLevels,
    addXP,
    getLevel,
    getDailyBonus,
    getXPProgress
};
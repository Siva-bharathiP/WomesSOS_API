// utils/securityTokens.js
const pool = require('../config/database');

async function getSecurityTeamTokens() {
    try {
        const [tokens] = await pool.execute(
            `SELECT fcm_token FROM womensos.security_team 
            WHERE fcm_token IS NOT NULL AND is_active = TRUE`
        );

        return tokens.map(t => t.fcm_token);
    } catch (error) {
        console.error('Error getting security tokens:', error);
        return [];
    }
}

module.exports = {
    getSecurityTeamTokens
};
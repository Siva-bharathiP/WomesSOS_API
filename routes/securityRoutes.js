const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const admin = require('../config/firebase');

/**
 * @swagger
 * /api/register-security:
 *   post:
 *     summary: Register a security team member (without manual FCM token)
 *     tags: [Security]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Security member registered
 */
router.post('/register-security', async (req, res) => {
    try {
        const { name, phone } = req.body;
        
        // Don't accept manual token - will be set by mobile app later
        await pool.execute(
            'INSERT INTO security_team (name, phone) VALUES (?, ?)',
            [name, phone]
        );
        
        res.json({ 
            success: true,
            message: "Security member registered. FCM token should be added via update-token endpoint."
        });
    } catch (error) {
        console.error('Security registration error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
});

/**
 * @swagger
 * /api/update-security-token:
 *   post:
 *     summary: Update security member's FCM token (called from mobile app)
 *     tags: [Security]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - securityId
 *               - fcmToken
 *             properties:
 *               securityId:
 *                 type: integer
 *               fcmToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token updated successfully
 */
router.post('/update-security-token', async (req, res) => {
    try {
        const { securityId, fcmToken } = req.body;
        
        if (!securityId || !fcmToken) {
            return res.status(400).json({ 
                success: false,
                message: "securityId and fcmToken are required" 
            });
        }

        // Validate token format
        if (!isValidFcmToken(fcmToken)) {
            return res.status(400).json({ 
                success: false,
                message: "Invalid FCM token format" 
            });
        }

        await pool.execute(
            'UPDATE security_team SET fcm_token = ? WHERE id = ?',
            [fcmToken, securityId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error("Error updating security token:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error" 
        });
    }
});

// Enhanced FCM token validation
function isValidFcmToken(token) {
    if (!token || typeof token !== 'string') return false;
    
    // Firebase FCM tokens are typically 152-164 characters long
    if (token.length < 152 || token.length > 164) return false;
    
    // Should contain only valid characters
    const validChars = /^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/;
    return validChars.test(token);
}

module.exports = router;
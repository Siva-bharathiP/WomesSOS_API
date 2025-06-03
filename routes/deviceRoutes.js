/**
 * @swagger
 * tags:
 *   name: Devices
 *   description: Device registration for notifications
 */

const express = require('express');
const router = express.Router();
const { registerDevice } = require('../controllers/deviceController');

// routes/deviceRoutes.js - Add new endpoint
router.post('/refresh-token', async (req, res) => {
    try {
        const { employeeId } = req.body;
        
        // Generate new FCM token
        const fcmToken = await admin.messaging().getToken();
        
        if (!fcmToken) {
            return res.status(400).json({ 
                success: false,
                message: "Failed to generate FCM token" 
            });
        }

        // Update existing token
        await pool.execute(
            'UPDATE employee_devices SET fcm_token = ? WHERE employee_id = ?',
            [fcmToken, employeeId]
        );
        
        res.json({ 
            success: true,
            fcmToken: fcmToken 
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
});

/**
 * @swagger
 * /api/register-device:
 *   post:
 *     summary: Register a device for push notifications
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - employeeId
 *               - fcmToken
 *             properties:
 *               employeeId:
 *                 type: integer
 *                 description: ID of the employee
 *               fcmToken:
 *                 type: string
 *                 description: Firebase Cloud Messaging token for the device
 *     responses:
 *       200:
 *         description: Device registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       500:
 *         description: Server error
 */
router.post('/register-device', registerDevice);

module.exports = router;
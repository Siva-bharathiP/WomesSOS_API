/**
 * @swagger
 * tags:
 *   name: SOS
 *   description: Emergency SOS management
 */

const express = require('express');
const router = express.Router();
const { triggerSos, acknowledgeSos } = require('../controllers/sosController');

/**
 * @swagger
 * /api/sos:
 *   post:
 *     summary: Trigger an SOS alert
 *     tags: [SOS]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - employeeId
 *             properties:
 *               employeeId:
 *                 type: integer
 *                 description: ID of the employee triggering the SOS
 *               location:
 *                 type: string
 *                 description: Location where the SOS is being triggered
 *     responses:
 *       200:
 *         description: SOS alert triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 alertId:
 *                   type: integer
 *                 location:
 *                   type: string
 *       400:
 *         description: Employee not found
 *       500:
 *         description: Server error
 */
router.post('/api/sos', triggerSos);

/**
 * @swagger
 * /api/acknowledge-sos:
 *   post:
 *     summary: Acknowledge an SOS alert
 *     tags: [SOS]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - alertId
 *             properties:
 *               alertId:
 *                 type: integer
 *                 description: ID of the alert to acknowledge
 *     responses:
 *       200:
 *         description: SOS alert acknowledged successfully
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
router.post('/acknowledge-sos', acknowledgeSos);

module.exports = router;
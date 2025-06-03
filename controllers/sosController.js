const pool = require('../config/database');
const { createSosAlert, acknowledgeSosAlert } = require("../models/sosModel");
const { getEmployeeById } = require("../models/employeeModel");
const { getSecurityTeamTokens } = require("../utils/securityTokens");
const { admin, database } = require("../config/firebase");
// Initialize Twilio client
const twilioClient = process.env.TWILIO_ENABLED === 'true' 
  ? require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;
// Helper function to validate FCM tokens
const isValidFcmToken = (token) => {
    if (!token || typeof token !== 'string') return false;
    const fcmTokenPattern = /^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/;
    return token.length > 100 && fcmTokenPattern.test(token);
};

// Function to send emergency notifications with sound and SMS
async function sendEmergencyNotificationWithSound(tokens, employee, alertId, location) {
    console.log('⏳ Starting sendEmergencyNotificationWithSound function');
    console.log('📱 Tokens received:', tokens.length);
    console.log('👤 Employee:', employee.id, employee.name);
    console.log('🚨 Alert ID:', alertId);
    console.log('📍 Location:', location);

    const emergencySound = "emergency"; // Custom sound name (must match mobile app)

    const baseMessage = {
        notification: {
            title: "🚨 EMERGENCY SOS ALERT!",
            body: `${employee.name} needs immediate assistance! Location: ${location || 'Unknown'}`,
        },
        data: {
            type: "sos",
            employeeId: employee.id.toString(),
            alertId: alertId.toString(),
            location: location || 'Unknown',
            sound: "emergency",
            priority: "high",
            click_action: "FLUTTER_NOTIFICATION_CLICK",
            vibration_pattern: "500,1000,500,1000,500"
        },
        android: {
            priority: "high",
            notification: {
                sound: emergencySound,
                channel_id: "emergency_alerts_channel",
                default_sound: true,
                vibrate_timings: ["0.5s", "1s", "0.5s", "1s", "0.5s"]
            }
        },
        apns: {
            headers: {
                "apns-priority": "10",
                "apns-push-type": "alert"
            },
            payload: {
                aps: {
                    sound: "emergency.caf",
                    'mutable-content': 1,
                    'interruption-level': 'critical',
                    'badge': 1
                }
            }
        }
    };

    let successCount = 0;
    let failureCount = 0;
    const failedTokens = [];

    try {
        console.log(`📤 Attempting to send notifications to ${tokens.length} devices`);

        for (const token of tokens) {
            if (!isValidFcmToken(token)) {
                console.log(`⚠️ Invalid token skipped: ${token}`);
                continue;
            }

            const message = {
                ...baseMessage,
                token: token
            };

            try {
                await admin.messaging().send(message);
                console.log(`✅ Notification sent to token: ${token}`);
                successCount++;
            } catch (error) {
                console.error(`❌ Failed to send to token ${token}:`, error.message);
                failureCount++;
                failedTokens.push({
                    token: token,
                    error: error.message
                });

                if (error.code === 'messaging/invalid-registration-token' ||
                    error.code === 'messaging/registration-token-not-registered') {
                    console.log(`🧹 Removing invalid token: ${token}`);
                    await removeInvalidToken(token);
                }
            }
        }

        console.log(`📊 Notification results - Success: ${successCount}, Failed: ${failureCount}`);

        // Always send SMS to security team (not just as fallback)
        if (process.env.TWILIO_ENABLED === 'true') {
            console.log('📲 Sending SMS notifications to security team');
            await sendEmergencySMS(employee, location, alertId);
        }

        return {
            successCount,
            failureCount,
            failedTokens
        };
    } catch (error) {
        console.error('❌ Error in sendEmergencyNotificationWithSound:', error);

        // Attempt SMS if FCM completely fails
        if (process.env.TWILIO_ENABLED === 'true') {
            console.log('📲 FCM failed completely, attempting SMS notifications');
            await sendEmergencySMS(employee, location, alertId);
        }

        throw error;
    } finally {
        console.log('🏁 Finished sendEmergencyNotificationWithSound execution');
    }
}

// Enhanced SMS notification function
async function sendEmergencySMS(employee, location, alertId) {
    try {
        // Get security team phone numbers and names from DB
        const [securityTeam] = await pool.execute(
            'SELECT id, name, phone FROM security_team WHERE phone IS NOT NULL'
        );
        
        if (securityTeam.length === 0) {
            console.log('No security team members with phone numbers found');
            return;
        }
        
        const phoneNumbers = securityTeam.map(member => ({
            id: member.id,
            name: member.name,
            phone: member.phone
        }));
        
        const message = `🚨 EMERGENCY ALERT (ID:${alertId})\n${employee.name} needs help!\nLocation: ${location || 'Unknown'}\nTime: ${new Date().toLocaleString()}\n\nReply 'ACK ${alertId}' to acknowledge.`;
        
        // Send SMS to each security team member
        const smsResults = await Promise.all(phoneNumbers.map(async member => {
            try {
                const result = await twilioClient.messages.create({
                    body: message,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: member.phone
                });
                
                // Log SMS delivery in database
                await pool.execute(
                    'INSERT INTO sms_notifications (alert_id, recipient_id, recipient_name, phone_number, message_sid, status) VALUES (?, ?, ?, ?, ?, ?)',
                    [alertId, member.id, member.name, member.phone, result.sid, 'sent']
                );
                
                return { success: true, memberId: member.id, sid: result.sid };
            } catch (smsError) {
                console.error(`Failed to send SMS to ${member.phone}:`, smsError);
                
                // Log failed SMS in database
                await pool.execute(
                    'INSERT INTO sms_notifications (alert_id, recipient_id, recipient_name, phone_number, status, error) VALUES (?, ?, ?, ?, ?, ?)',
                    [alertId, member.id, member.name, member.phone, 'failed', smsError.message]
                );
                
                return { success: false, memberId: member.id, error: smsError.message };
            }
        }));
        
        const successfulSMS = smsResults.filter(r => r.success).length;
        console.log(`Sent emergency SMS to ${successfulSMS}/${phoneNumbers.length} security team members`);
        
        return smsResults;
    } catch (error) {
        console.error('Failed to send emergency SMS:', error);
        throw error;
    }
}

// Remove invalid FCM token from database
async function removeInvalidToken(token) {
    try {
        await pool.execute(
            'UPDATE security_team SET fcm_token = NULL WHERE fcm_token = ?',
            [token]
        );
        console.log(`Removed invalid FCM token: ${token}`);
    } catch (dbError) {
        console.error('Error removing invalid token:', dbError);
    }
}

// Main SOS trigger function
exports.triggerSos = async (req, res) => {
    try {
        console.log("--- SOS TRIGGER REQUEST RECEIVED ---");
        console.log("Request Body:", req.body);

        const { employeeId, location } = req.body;

        // Validate required fields
        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        const employee = await getEmployeeById(employeeId);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Create SOS alert in database
        const result = await createSosAlert(employeeId, location);
        console.log("SOS Alert created in database. Alert ID:", result.insertId);

        // Get the full alert details
        const [alert] = await pool.execute(
            'SELECT * FROM sos_alerts WHERE id = ?',
            [result.insertId]
        );

        if (!alert.length) {
            throw new Error("Failed to retrieve created alert");
        }

        const sosAlert = alert[0];

        // Store in Firebase Realtime DB for realtime dashboard updates
        try {
            const alertRef = database.ref('sos_alerts').push();
            await alertRef.set({
                alertId: result.insertId,
                employeeId: employeeId,
                employeeName: employee.name,
                location: location || 'Unknown',
                status: sosAlert.status,
                createdAt: new Date().toISOString(),
                priority: "critical",
                sound: "emergency",
                vibration: true
            });
            console.log("✅ SOS alert stored in Firebase Realtime DB with key:", alertRef.key);
        } catch (firebaseError) {
            console.error("❌ Failed to store SOS in Firebase DB:", firebaseError.message);
        }

        // Get security team tokens
        let securityTokens = await getSecurityTeamTokens();
        let successCount = 0;
        let failureCount = 0;
        let smsResults = [];

        if (securityTokens.length > 0) {
            // Filter and clean invalid tokens
            const validTokens = securityTokens.filter(isValidFcmToken);
            const invalidTokens = securityTokens.filter(token => !isValidFcmToken(token));

            // Clean up invalid tokens
            if (invalidTokens.length > 0) {
                console.log(`Found ${invalidTokens.length} invalid tokens, cleaning...`);
                await Promise.all(invalidTokens.map(removeInvalidToken));
            }

            if (validTokens.length > 0) {
                // Send notifications with sound
                const notificationResult = await sendEmergencyNotificationWithSound(
                    validTokens,
                    employee,
                    result.insertId,
                    location
                );
                
                successCount = notificationResult.successCount;
                failureCount = notificationResult.failureCount;
            }
        }

        // Return response
        res.json({
            success: true,
            alert: {
                id: sosAlert.id,
                employeeId: sosAlert.employee_id,
                status: sosAlert.status,
                location: sosAlert.location,
                createdAt: sosAlert.created_at,
                acknowledgedAt: sosAlert.acknowledged_at,
                acknowledgedBy: sosAlert.acknowledged_by,
                notifications: {
                    push: {
                        sent: successCount,
                        failed: failureCount,
                        total: successCount + failureCount
                    },
                    sms: smsResults
                }
            },
            message: "SOS triggered successfully"
        });

    } catch (error) {
        console.error("SOS trigger error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Acknowledge SOS function with SMS response handling
exports.acknowledgeSos = async (req, res) => {
    try {
        const { alertId, securityUserId, viaSms = false } = req.body;

        if (!alertId || !securityUserId) {
            return res.status(400).json({
                success: false,
                message: "Alert ID and security user ID are required"
            });
        }

        // Get security user details
        const [user] = await pool.execute(
            'SELECT name FROM security_team WHERE id = ?',
            [securityUserId]
        );
        
        if (user.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Security user not found"
            });
        }

        const userName = user[0].name;

        // Update database
        await pool.execute(
            'UPDATE sos_alerts SET status = "acknowledged", acknowledged_at = NOW(), acknowledged_by = ? WHERE id = ?',
            [securityUserId, alertId]
        );

        // Get updated alert details
        const [alert] = await pool.execute(
            'SELECT * FROM sos_alerts WHERE id = ?',
            [alertId]
        );

        // Update Firebase
        try {
            await database.ref('sos_alerts').child(alertId.toString()).update({
                status: "acknowledged",
                acknowledgedAt: new Date().toISOString(),
                acknowledgedBy: securityUserId,
                acknowledgedByName: userName,
                acknowledgedVia: viaSms ? 'sms' : 'app'
            });
        } catch (firebaseError) {
            console.error("Failed to update Firebase:", firebaseError);
        }

        res.json({
            success: true,
            alert: alert[0],
            message: "SOS acknowledged successfully"
        });

    } catch (error) {
        console.error("Acknowledge SOS error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// New function to handle SMS responses (for Twilio webhook)
exports.handleSmsResponse = async (req, res) => {
    try {
        const { Body, From } = req.body;
        
        // Parse the SMS body for acknowledgment command
        const ackMatch = Body.match(/^ACK\s+(\d+)$/i);
        if (!ackMatch) {
            return res.status(400).send('Invalid command format. Use "ACK <alertId>"');
        }
        
        const alertId = parseInt(ackMatch[1]);
        if (isNaN(alertId)) {
            return res.status(400).send('Invalid alert ID');
        }
        
        // Find security team member by phone number
        const [securityUser] = await pool.execute(
            'SELECT id, name FROM security_team WHERE phone = ?',
            [From]
        );
        
        if (securityUser.length === 0) {
            return res.status(404).send('Security team member not found');
        }
        
        const userId = securityUser[0].id;
        
        // Acknowledge the alert
        await this.acknowledgeSos(
            { body: { alertId, securityUserId: userId, viaSms: true } },
            { json: () => {} }
        );
        
        // Send confirmation SMS
        if (process.env.TWILIO_ENABLED === 'true') {
            await twilioClient.messages.create({
                body: `✅ Alert ${alertId} acknowledged successfully. Thank you ${securityUser[0].name}!`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: From
            });
        }
        
        res.status(200).send('Alert acknowledged successfully');
    } catch (error) {
        console.error('Error handling SMS response:', error);
        res.status(500).send('Internal server error');
    }
};
const admin = require('../config/firebase');
const pool = require('../config/database');

exports.sendNotification = async (fcmToken, message) => {
    try {
        await admin.messaging().send({
            token: fcmToken,
            notification: {
                title: message.title,
                body: message.body
            },
            data: message.data || {}
        });
        console.log('Notification sent successfully');
        return true;
    } catch (error) {
        console.error('Error sending notification:', error);
        
        if (error.code === 'messaging/invalid-registration-token' || 
            error.code === 'messaging/registration-token-not-registered') {
            const connection = await pool.getConnection();
            try {
                await connection.execute(
                    'DELETE FROM employee_devices WHERE fcm_token = ?',
                    [fcmToken]
                );
                console.log('Removed invalid FCM token');
            } finally {
                connection.release();
            }
        }
        return false;
    }
};
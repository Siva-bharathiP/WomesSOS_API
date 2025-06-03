const pool = require('../config/database');

async function createSosAlert(employeeId, location) {
    const [result] = await pool.execute(
        'INSERT INTO sos_alerts (employee_id, location) VALUES (?, ?)',
        [employeeId, location]
    );
    return result;
}
async function acknowledgeSosAlert(alertId) {
    await pool.execute(
        'UPDATE sos_alerts SET status = "acknowledged" WHERE id = ?',
        [alertId]
    );
}

module.exports = {
    createSosAlert,
    acknowledgeSosAlert
};
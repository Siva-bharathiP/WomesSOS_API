const pool = require('../config/database');

async function createTables() {
    const createEmployeesTable = `
        CREATE TABLE IF NOT EXISTS employees (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            phone VARCHAR(20) NOT NULL
        )
    `;

    const createSosAlertsTable = `
        CREATE TABLE IF NOT EXISTS sos_alerts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status ENUM('pending', 'acknowledged') DEFAULT 'pending',
            location VARCHAR(255),
            acknowledged_at TIMESTAMP NULL,
            acknowledged_by INT NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id),
            FOREIGN KEY (acknowledged_by) REFERENCES security_team(id)
        )
    `;
    const createEmployeeDevicesTable = `
        CREATE TABLE IF NOT EXISTS employee_devices (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            fcm_token VARCHAR(255) NOT NULL ,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        )
    `;

        const createSecurityTeamTable = `
        CREATE TABLE IF NOT EXISTS security_team (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            fcm_token VARCHAR(255) ,
            is_active BOOLEAN DEFAULT TRUE,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `;
    const createSafetyChecksTable = `
        CREATE TABLE IF NOT EXISTS safety_checks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            swipe_out_time TIMESTAMP NOT NULL,
            first_notification_sent BOOLEAN DEFAULT FALSE,
            second_notification_sent BOOLEAN DEFAULT FALSE,
            ivr_called BOOLEAN DEFAULT FALSE,
            email_sent BOOLEAN DEFAULT FALSE,
            confirmed_at TIMESTAMP NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        )
    `;
     const createSmsNotificationsTable = `
        CREATE TABLE IF NOT EXISTS sms_notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            alert_id INT NOT NULL,
            recipient_id INT NOT NULL,
            recipient_name VARCHAR(255) NOT NULL,
            phone_number VARCHAR(20) NOT NULL,
            message_sid VARCHAR(255),
            status VARCHAR(50),
            error TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    const connection = await pool.getConnection();
    try {
        await connection.query(createEmployeesTable);
        await connection.query(createSecurityTeamTable);
        await connection.query(createSosAlertsTable);
        await connection.query(createEmployeeDevicesTable);
        await connection.query(createSafetyChecksTable);

        await connection.query(createSmsNotificationsTable);

        console.log('Tables are ensured to exist');

        // Check if employees already exist
        const [existingEmployees] = await connection.query('SELECT COUNT(*) as count FROM employees');
        if (existingEmployees[0].count === 0) {
            // Insert dummy employees
        const dummyEmployees = [
            ['Alice Johnson', '+917904003161'],   // 7904003161
            ['Bob Smith', '+919842050443'],       // 9842050443
            ['Charlie Brown', '+917904003161'],   // 7904003161
            ['Diana Prince', '+919842050443'],    // 9842050443
            ['Ethan Hunt', '+917904003161'],      // 7904003161
            ['Fiona Gallagher', '+919842050443'], // 9842050443
            ['George Clooney', '+917904003161'],  // 7904003161
            ['Hannah Montana', '+919842050443'],  // 9842050443
            ['Ian Somerhalder', '+917904003161'], // 7904003161
            ['Jane Doe', '+919842050443']         // 9842050443
        ];

            await connection.query(
                'INSERT INTO employees (name, phone) VALUES ?',
                [dummyEmployees]
            );
            console.log('Inserted dummy employees');
        } else {
            console.log('Employees already exist, skipping dummy insert');
        }

        // Check if security team already exists
        const [existingSecurity] = await connection.query('SELECT COUNT(*) as count FROM security_team');
        if (existingSecurity[0].count === 0) {
            // Insert dummy security team with sample FCM tokens
          const yourFcmToken = 'fRKeso1jSq6S-ree91XfwC:APA91bHScVq1jflDkvRQDE6KpSPRkZswIoEQuCs7kETwm7CTiU1eEnai7eKN4KNnAv_n1e7N_P9DdXdJfq7GgpCLomUQBR0AnUFlQhyFVlxBBUJ92VLY3qw';

            const dummySecurity = [
                ['Security Officer 1', '+917904003161', yourFcmToken],   // 7904003161
                ['Security Officer 2', '+919842050443', yourFcmToken],   // 9842050443
                ['Security Supervisor', '+917904003161', yourFcmToken],  // 7904003161
                ['Emergency Responder', '+919842050443', yourFcmToken],  // 9842050443
                ['Night Shift Guard', '+917904003161', yourFcmToken]     // 7904003161
            ];


            await connection.query(
                'INSERT INTO security_team (name, phone, fcm_token) VALUES ?',
                [dummySecurity]
            );
            console.log('Inserted dummy security team with FCM tokens');
        } else {
            console.log('Security team already exists, skipping dummy insert');
        }
    } catch (error) {
        console.error('Error creating tables or inserting dummy data:', error);
    } finally {
        connection.release();
    }
}

async function getEmployeeById(employeeId) {
    const [employee] = await pool.execute(
        'SELECT id, name FROM employees WHERE id = ?',
        [employeeId]
    );
    return employee[0];
}

async function getSecurityTeam() {
    const [securityTeam] = await pool.execute(
        'SELECT id, name, phone, fcm_token, is_active FROM security_team'
    );
    return securityTeam;
}

module.exports = {
    createTables,
    getEmployeeById,
    getSecurityTeam
};
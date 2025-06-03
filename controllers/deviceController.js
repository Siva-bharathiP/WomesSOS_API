const pool = require('../config/database');

exports.registerDevice = async (req, res) => {
    try {
        const { employeeId, fcmToken } = req.body;
        
        // Basic validation (only check if fields exist)
        if (!employeeId || !fcmToken) {
            return res.status(400).json({ 
                success: false,
                message: "Both employeeId and fcmToken are required" 
            });
        }

        // Check if employee exists (optional, if needed)
        const [employee] = await pool.execute(
            'SELECT id FROM employees WHERE id = ?',
            [employeeId]
        );
        
        if (employee.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Remove any existing token for this employee (optional)
        await pool.execute(
            'DELETE FROM employee_devices WHERE employee_id = ?',
            [employeeId]
        );
        
        // Insert the token (no uniqueness check)
        await pool.execute(
            'INSERT INTO employee_devices (employee_id, fcm_token) VALUES (?, ?)',
            [employeeId, fcmToken]
        );
        
        res.json({ 
            success: true,
            message: "Device registered successfully (token may be shared)"
        });
    } catch (error) {
        console.error('Device registration error:', error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error" 
        });
    }
};
const app = require('./app');
const { createTables } = require('./models/employeeModel');

const PORT = 3001;
createTables().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
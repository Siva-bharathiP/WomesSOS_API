const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const sosRoutes = require('./routes/sosRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const setupSwagger = require('./config/swagger'); // Add this line
const securityRoutes = require('./routes/securityRoutes');
const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use('/api', securityRoutes);
// Routes
app.use('/', sosRoutes);
app.use('/api', deviceRoutes);

// Setup Swagger
setupSwagger(app); // Add this line

module.exports = app;
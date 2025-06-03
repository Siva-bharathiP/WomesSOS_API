const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://womensos-e247a-default-rtdb.firebaseio.com/'
});


const database = admin.database();

module.exports = { admin, database };
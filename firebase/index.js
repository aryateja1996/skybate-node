var admin = require("firebase-admin");
const { getFirestore } = require('firebase-admin/firestore')
var serviceAccount = require("./serviceAccountKey.json");

const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    apiKey: "AIzaSyD27KzLqkRO22UoXF0h5qfBqVkSycwJfR8",
    authDomain: "skybate-ca862.firebaseapp.com",
    projectId: "skybate-ca862",
    storageBucket: "skybate-ca862.appspot.com",
    messagingSenderId: "156949849763",
    appId: "1:156949849763:web:c8de6c9af0297324cd4116",
    measurementId: "G-F25D72YMTQ",
});

const db = getFirestore(app)

module.exports = { db }
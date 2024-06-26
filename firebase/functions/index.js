global.__base = __dirname + '/';

var functions = require('firebase-functions');
var firebase = require('firebase-admin');

if (!firebase.apps.length) {
  firebase.initializeApp();
}

var toka = require(__base + 'toka');

exports.api = functions.https.onRequest((req, res) => {
   return toka.api(req, res);
});

exports.pinataAnalytics = functions.pubsub.topic('log-frame').onPublish((message) => {
    return toka.pinataAnalytics(message);
});
exports.processWebhook = functions.pubsub.topic('webhook').onPublish((message) => {
    return toka.processWebhook(message);
});
exports.processMint = functions.pubsub.topic('mint').onPublish((message) => {
    return toka.processMint(message);
});

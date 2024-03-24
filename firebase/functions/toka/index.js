var functions = require('firebase-functions');
var firebase = require('firebase-admin');
var storage = firebase.storage();
const bucket = storage.bucket();
var db = firebase.firestore();

const express = require("express");
const api = express();
const cors = require("cors");

const fetch = require('node-fetch');
const _ = require('lodash');
const moment = require('moment');
var uniqid = require('uniqid');

const { ethers } = require("ethers");

var actions = require(__base + 'toka/actions');
var frames = require(__base + 'toka/frames');
var util = require(__base + 'toka/util');


const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
};

const zora721JSON = require(__base + 'toka/abis/ERC721Drop.json');

module.exports.created = async function(snap, context) {
  const item = snap.data();
  
} // created

module.exports.updated = async function(change, context) {
  const before = change.before.data();
  const after = change.after.data();
  const snap = change.after;

} // updated

module.exports.cron = async function(context) {

  return 1;
} // cron

module.exports.pinataAnalytics = async function(message) {
    // TODO: send to pinata
    //console.log("PA: pinataAnalytics message", JSON.stringify(message));
    // Decode the PubSub Message body.
    const messageBody = message.data ? Buffer.from(message.data, 'base64').toString() : null;
    //console.log("PA: messageBody", JSON.stringify(messageBody));
    const options = {
        method: 'POST',
        headers: {Authorization: `Bearer ${process.env.PINATA_AUTH_TOKEN}`, 'Content-Type': 'application/json'},
        body: JSON.stringify(message.json)
    };
    
    return fetch('https://api.pinata.cloud/farcaster/frames/interactions', options)
    .then(response => response.json())
    .then(response => console.log(response))
    .catch(err => console.error(err));
} // pinataAnalytics

module.exports.processWebhook = async function(message) {
    //console.log("PA: processWebhook message", JSON.stringify(message));
    // Decode the PubSub Message body.
    const messageBody = message.data ? Buffer.from(message.data, 'base64').toString() : null;
    // TODO: handle the webhook

    return 1;
};

module.exports.processMint = async function(message) {
    //console.log("PA: processMint message", JSON.stringify(message));
    // Decode the PubSub Message body.
    const messageBody = message.data ? Buffer.from(message.data, 'base64').toString() : null;
    // TODO: handle the mint event

    return 1;
};

api.use(cors({ origin: true })); // enable origin cors

api.get(['/frames/:id', '/frames/:id/:cachebuster'], async function (req, res) {
  // TODO: code this
}); // GET /frames/:id

api.post(['/collect/base[:]:address/:tokenId/:extra', '/collect/base[:]:address/:tokenId', '/collect/base[:]:address' ], async function (req, res) {
  //console.log("body", json.stringify(req.body));
  //console.log("untrusted", req.body.untrustedData);
  //console.log("trusted", req.body.trustedData);
  //console.log("start POST frame with path", req.path);
  var frame;
  frame = await actions.mint(req);
  if ("redirect" in frame) {
    // this is a 302 redirect so don't respond with a frame
    return res.redirect(frame.redirect);
  }
  if ("chainId" in frame) {
    // this is actually a transaction json
    return res.json(frame);
  }
  //console.log("frame", JSON.stringify(frame));
  
  html = await util.frameHTML(frame);
  //console.log("html", html);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
  });
  return res.end(html);
}); // POST /collect

api.post(['/admin/base[:]:address/:tokenId/:extra', '/admin/base[:]:address/:tokenId', '/admin/base[:]:address' ], async function (req, res) {
    //console.log("body", json.stringify(req.body));
    //console.log("untrusted", req.body.untrustedData);
    //console.log("trusted", req.body.trustedData);
    //console.log("start POST frame with path", req.path);
    var frame;
    frame = await actions.admin(req);
    if ("redirect" in frame) {
      // this is a 302 redirect so don't respond with a frame
      return res.redirect(frame.redirect);
    }
    if ("chainId" in frame) {
      // this is actually a transaction json
      return res.json(frame);
    }
    //console.log("frame", JSON.stringify(frame));
    
    html = await util.frameHTML(frame);
    //console.log("html", html);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
    });
    return res.end(html);
  }); // POST /admin/

api.get(['/collect/base[:]:address/:tokenId/:extra', '/collect/base[:]:address/:tokenId', '/collect/base[:]:address'], async function (req, res) {
    console.log("start GET /collect with path", req.path);
    const frame = frames.mint(req);
    const html = await util.frameHTML(frame);
    // TODO: update cache when launched
    res.set('Cache-Control', 'public, max-age=60, s-maxage=120');
    //res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
    });
    return res.end(html);
}); // GET /api/collect

api.get(['/admin/base[:]:address/:tokenId/:extra', '/admin/base[:]:address/:tokenId', '/admin/base[:]:address'], async function (req, res) {
    console.log("start GET /admin with path", req.path);
    const frame = frames.admin(req);
    const html = await util.frameHTML(frame);
    // TODO: update cache when launched
    res.set('Cache-Control', 'public, max-age=60, s-maxage=120');
    //res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
    });
    return res.end(html);
}); // GET /api/admin

api.post('/api/webhook/mention/:fid', async function (req, res) {
  var fid = req.params.fid;
  console.log("mention webhook req.body", JSON.stringify(req.body));  
  return res.json({"result": "ok", "fid": fid});
}); // POST /api/webhook/:fid

api.post('/api/webhook/:keyword', async function (req, res) {
  console.log("keyword webhook req.body", JSON.stringify(req.body));  
  return res.json({"result": "ok"});
}); // POST /api/webhook/:keyword

api.get(['/api/contract/images/base/:address'], async function (req, res) {
  const address = req.params.address;
  const provider = new ethers.providers.JsonRpcProvider(process.env.API_URL_BASE);
  // contractURI abi
  const abi = [ "function contractURI() external view returns (string memory)" ];
  const contract = new ethers.Contract(address, abi, provider);
  const metadata = await contract.contractURI();
  console.log("metadata", metadata);
  var image;
  // if metadata starts with "data:application/json;base64," then decode it
  if (metadata.startsWith("data:application/json;base64,")) {   
    const decodedMetadata = JSON.parse(Buffer.from(metadata.split(",")[1], 'base64').toString('utf-8'));
    // get the image
    image = decodedMetadata.image;
  } else if (metadata.startsWith("ipfs://")) {
    // fetch from ipfs
    const metaResponse = await fetch(`https://ipfs.decentralized-content.com/ipfs/${metadata.replace("ipfs://", "")}`);
    const meta = await metaResponse.json();
    image = meta.image;
  } else if (metadata.startsWith("https://")) {
    const metaResponse = await fetch($metadata);
    const meta = await metaResponse.json();
    image = meta.image;
  } else {
    console.log("metadata can't get image", metadata);
  } // if metadata
  if (image.startsWith("ipfs://")) {
    // fetch from ipfs
    image = `https://ipfs.decentralized-content.com/ipfs/${image.replace("ipfs://", "")}`;
  }
  // fetch the image
  let sourceImage = await fetch(image);
  if (!sourceImage.ok) {
    // return 404 error code:
    return res.status(404).send('Not found');
  }
  const mimetype = sourceImage.headers.get('content-type');
  let sourceBuffer = Buffer.from(await sourceImage.arrayBuffer());
  //console.log("sourceBuffer", sourceBuffer);
  const img = Buffer.from(sourceBuffer);
  res.set('Cache-Control', 'public, max-age=60, s-maxage=120');
  res.writeHead(200, {
    'Content-Type': mimetype,
    'Content-Length': img.length
  });
  return res.end(img);
}); // GET /api/contract/images/base/:address

module.exports.api = api;


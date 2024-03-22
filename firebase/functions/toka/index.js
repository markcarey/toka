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

async function frameHTML(frame) {
  // TODO: move this to util
  console.log("build html for frame", JSON.stringify(frame));
  return new Promise(async function(resolve, reject) { 
    var html = '';
    var h1 = `https://toka.lol/frames/${frame.id}`;
    if ("h1" in frame) {
      h1 = frame.h1;
    }
    var buttons = '';
    var textField = '';
    // for loop through frame.buttons array
    if ("buttons" in frame) {
      for (let i = 0; i < frame.buttons.length; i++) {
        buttons += `<meta name="fc:frame:button:${i+1}" content="${frame.buttons[i].label}" />`;
        buttons += `<meta name="fc:frame:button:${i+1}:action" content="${frame.buttons[i].action}" />`;
        if (frame.buttons[i].action == "link" || frame.buttons[i].action == "tx") {
          buttons += `<meta name="fc:frame:button:${i+1}:target" content="${frame.buttons[i].target}" />`;
        }
      }
    }
    var square = "";
    if ("image" in frame) {
      // do nothing, assumes image is already a data URI or URL
    } else {
      frame.square = true;
      if ("imageText" in frame) {
        frame.image = await util.imageFromText(frame.imageText);
      } else {
        frame.image = await util.imageFromText("404 - Image not found");
      }
    }
    if ("textField" in frame) {
      textField = `<meta name="fc:frame:input:text" content="${frame.textField}" />`;
    }
    console.log("frame.image", frame.image);
    if ("square" in frame) {
      if (frame.square == true) {
        square = `<meta name="fc:frame:image:aspect_ratio" content="1:1" />`;
      }
    }
    var state = "";
    if ("state" in frame) {
      const encodedState = encodeURIComponent(JSON.stringify(frame.state));
      state = `<meta name="fc:frame:state" content="${encodedState}" />`;
    }
    html = `<!DOCTYPE html>
          <html lang="en">
          <head>
              <title>${frame.id}</title>
              <meta charSet="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <meta name="fc:frame" content="vNext" />
              <meta name="fc:frame:image" content="${frame.image}" />
              <meta name="fc:frame:post_url" content="${frame.postUrl}" />
              ${buttons}
              ${square}
              ${textField}
              ${state}
              <meta name="og:image" content="${frame.image}" />
              <meta name="og:title" content="${frame.id}" />
          </head>

          <body>
            <h1>${h1}</h1>
            <div>
              <img src="${frame.image}" width="400" />
            </div>
          </body>

          </html>`;
    //console.log("html", html);
    return resolve(html);
  }); // return new Promise
}

api.use(cors({ origin: true })); // enable origin cors


api.get(['/frames/:id', '/frames/:id/:cachebuster'], async function (req, res) {
  // TODO: code this
}); // GET /frames/:id

api.post(['/frames/:id', '/frames/:id/:session/:extra', '/frames/:id/:session([^/]*)' ], async function (req, res) {
  //console.log("body", json.stringify(req.body));
  //console.log("untrusted", req.body.untrustedData);
  //console.log("trusted", req.body.trustedData);
  //console.log("start POST frame with path", req.path);
  var frame;
  frame = await actions[req.params.id](req);
  if ("redirect" in frame) {
    // this is a 302 redirect so don't respond with a frame
    return res.redirect(frame.redirect);
  }
  if ("chainId" in frame) {
    // this is actually a transaction json
    return res.json(frame);
  }
  //console.log("frame", JSON.stringify(frame));
  
  html = await frameHTML(frame); // TODO: move fucntio to util
  //console.log("html", html);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
  });
  return res.end(html);
}); // POST /frames/:id

api.get('/api/mint/:address/:tokenId', async function (req, res) {
  console.log("start GET frame with path", req.path);
  const frameRef = db.collection('frames').doc('aaaa');
    var doc = await frameRef.get();
    if (doc.exists) {
      console.log("frame doc exists for " + req.params.id);
      const frame = doc.data();
      frame.id = "aaaa";
      frame.postUrl = `https://toka.lol/api/mint/${req.params.address}/${req.params.tokenId}/${req.params.quantity}`;
      const html = await frameHTML(frame);
      //res.set('Cache-Control', 'public, max-age=60, s-maxage=120');
      res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
      });
      return res.end(html);
    } else {
      console.log("frame doc does not exist for " + req.params.id);
      return res.json({"result": "no frame yet"});
    }
}); // GET /api/mint/:address/:tokenId

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


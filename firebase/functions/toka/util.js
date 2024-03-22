var functions = require('firebase-functions');
var firebase = require('firebase-admin');
var storage = firebase.storage();
const bucket = storage.bucket();
var db = firebase.firestore();

const fetch = require('node-fetch');
var request = require('request');
const _ = require('lodash');
const { ethers } = require("ethers");

const {getCanvasImage, HorizontalImage, registerFont, UltimateTextToImage, VerticalImage} = require("ultimate-text-to-image");
registerFont("Impact.ttf", {family: "Impact"}); // register font
registerFont("Inter-Bold.ttf", {family: "Inter"}); // register font
registerFont("SartoshiScript-Regular.otf", {family: "Sartoshi"}); // register font

const { parse } = require('node-html-parser');
const Jimp = require('jimp');
const { Readable } = require('stream');
var FormData = require('form-data');


const degenJSON = require(__base + 'toka/abis/DEGEN.json');
const zora721JSON = require(__base + 'toka/abis/ERC721Drop.json');
const zora1155JSON = require(__base + 'toka/abis/Zora1155.json');
const zora1155FixedPriceJSON = require(__base + 'toka/abis/Zora1155FixedPrice.json');

const zoraAddresses = {
    "base": {
      "CONTRACT_1155_IMPL": "0xAF5A4F6F6640734d7D000321Bb27De40D4Ae91f6",
      "CONTRACT_1155_IMPL_VERSION": "2.7.0",
      "FACTORY_IMPL": "0x7B59c0378F540c0356A5DAEF7574255A7C74EC76",
      "FACTORY_PROXY": "0x777777C338d93e2C7adf08D102d45CA7CC4Ed021",
      "FIXED_PRICE_SALE_STRATEGY": "0x04E2516A2c207E84a1839755675dfd8eF6302F0a",
      "MERKLE_MINT_SALE_STRATEGY": "0xf48172CA3B6068B20eE4917Eb27b5472f1f272C7",
      "PREMINTER_IMPL": "0x6f4f0c7748050d178b50cB000c94d54ea54A82aA",
      "PREMINTER_PROXY": "0x7777773606e7e46C8Ba8B98C08f5cD218e31d340",
      "REDEEM_MINTER_FACTORY": "0x78964965cF77850224513a367f899435C5B69174",
      "UPGRADE_GATE": "0xbC50029836A59A4E5e1Bb8988272F46ebA0F9900",
      "timestamp": 1706663976
    }
};

const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
};

module.exports = {

    "getMintPrice": async function(state) {
        const util = module.exports;
        return new Promise(async function(resolve, reject) {
            const provider = new ethers.providers.JsonRpcProvider({"url": process.env.API_URL_BASE});
            // is contract ERC721 or ERC1155?
            const abi = [ "function supportsInterface(bytes4 interfaceId) external view returns (bool)" ];
            console.log("contractAddress b4 supportsInterface", state.contractAddress);
            const c = new ethers.Contract(state.contractAddress, abi, provider);
            const is721 = await c.supportsInterface("0x80ac58cd");
            console.log("is721", is721);
            const is1155 = await c.supportsInterface("0xd9b67a26");
            console.log("is1155", is1155);

            if (is721) {
                state.contractType = "ERC721";
                const zora721 = new ethers.Contract(state.contractAddress, zora721JSON.abi, provider);

                const feeData = await zora721.zoraFeeForAmount(1);
                const fee = feeData.fee;
                console.log("fee", fee);
                // fee as hex
                const feeHex = ethers.utils.hexlify(fee);
                console.log("feeHex", feeHex);
                //console.log("fee from parse ether", ethers.utils.parseEther("0.000777")._hex);
                state.fee = fee;
                state.feeHex = feeHex;
            } else if (is1155) {
                state.contractType = "ERC1155";
                const zora1155 = new ethers.Contract(state.contractAddress, zora1155JSON.abi, provider);
                // get the fee from the sales strategy contract
                const salesStrategy = new ethers.Contract(zoraAddresses.base.FIXED_PRICE_SALE_STRATEGY, zora1155FixedPriceJSON.abi, provider);
                const salesConfig = await salesStrategy.sale(state.contractAddress, state.tokenId ? state.tokenId : 1);
                console.log("salesConfig", salesConfig);
                const price = salesConfig.pricePerToken;
                console.log("price", price);
                var fee = await zora1155.mintFee();
                console.log("fee", fee);
                // add the price to the fee
                fee = fee.add(price);
                console.log("fee", fee);
                // fee as hex
                const feeHex = ethers.utils.hexlify(fee);
                console.log("feeHex", feeHex);
                state.fee = fee;
                state.feeHex = feeHex;
            }
            return resolve(state);
        }); // return new Promise
    }, // getMintPrice

    "getFCUserbyAddress": async function(addresses) {
        const util = module.exports;
        // addressses as comma separated string
        const addressString = addresses.join(",");
        return new Promise(async function(resolve, reject) {
            var response = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${addressString}`, { 
                method: 'GET', 
                headers: {
                    'Accept': 'application/json', 
                    'Content-Type': 'application/json',
                    'Api_key': process.env.NEYNAR_API_KEY
                }
            });
            var userResult = await response.json();
            console.log("neynar user/search", JSON.stringify(userResult));
            return resolve(userResult);
        }); // return new Promise
    }, // getFCUserbyAddress

    "getAddressFromFname": async function(fname) {
        const util = module.exports;
        return new Promise(async function(resolve, reject) {
            // use neynar api to get user by username
            const user = await util.getFCUserbyUsername(fname);
            console.log("user", user);
            var address;
            if (user) {
                // get last verified eth address
                if ("verified_addresses" in user) {
                    if ("eth_addresses" in user.verified_addresses) {
                        address = user.verified_addresses.eth_addresses[user.verified_addresses.eth_addresses.length-1];
                    } // if eth_addresses
                } // if verified_addresses
            } // if user
            console.log("address", address);
            return resolve(address);
        }); // return new Promise
    }, // getAddressFromFname

    "getMinterKeys": function() {
        const minterKeys = [
            process.env.MINTER_1,
            process.env.MINTER_2,
            process.env.MINTER_3,
            process.env.MINTER_4,
            process.env.MINTER_5,
            process.env.MINTER_6,
            process.env.MINTER_7,
            process.env.MINTER_8,
            process.env.MINTER_9,
            process.env.MINTER_10
        ];
        return minterKeys;
    }, // getMinterKeys

    "getFCUserbyUsername": async function(username) {
        username = username.replace("@", "");
        return new Promise(async function(resolve, reject) { 
            var response = await fetch(`https://api.neynar.com/v2/farcaster/user/search?q=${username}&viewer_fid=8685`, { 
                method: 'GET', 
                headers: {
                    'Accept': 'application/json', 
                    'Content-Type': 'application/json',
                    'Api_key': process.env.NEYNAR_API_KEY
                }
            });
            var userResult = await response.json();
            console.log("neynar user/search", JSON.stringify(userResult));
            var user;
            if ("result" in userResult) {
                if ("users" in userResult.result) {
                    user = userResult.result.users[0];
                }
            }
            return resolve(user);
        }); // return new Promise
    }, // getFCUserbyUsername

    "getAllCastsInThread": async function(threadHash) {
        return new Promise(async function(resolve, reject) {
            var casts = [];
            var response = await fetch(`https://api.neynar.com/v1/farcaster/all-casts-in-thread?threadHash=${threadHash}&viewerFid=8685`, { 
                method: 'GET', 
                headers: {
                    'Accept': 'application/json', 
                    'Content-Type': 'application/json',
                    'Api_key': process.env.NEYNAR_API_KEY
                }
            });
            var castsResult = await response.json();
            //console.log(JSON.stringify(castsResult));
            var user;
            if ("result" in castsResult) {
                if ("casts" in castsResult.result) {
                    casts = castsResult.result.casts;
                }
            }
            return resolve(casts);
        }); // return new Promise
    }, // getAllCastsInThread

    "getCast": async function(hash) {
        return new Promise(async function(resolve, reject) {
            var cast;
            var response = await fetch(`https://api.neynar.com/v1/farcaster/cast?hash=${hash}&viewerFid=8685`, { 
                method: 'GET', 
                headers: {
                    'Accept': 'application/json', 
                    'Content-Type': 'application/json',
                    'Api_key': process.env.NEYNAR_API_KEY
                }
            });
            var castResult = await response.json();
            //console.log(JSON.stringify(castResult));
            if ("result" in castResult) {
                if ("cast" in castResult.result) {
                    cast = castResult.result.cast;
                }
            }
            return resolve(cast);
        }); // return new Promise
    }, // getCast

    "validate": async function(req) {
        return new Promise(async function(resolve, reject) { 
            var body = {
                "message_bytes_in_hex": req.body.trustedData.messageBytes,
                "cast_reaction_context": true,
                "follow_context": true
              };
              var response = await fetch('https://api.neynar.com/v2/farcaster/frame/validate', { 
                method: 'POST', 
                headers: {
                    'Accept': 'application/json', 
                    'Content-Type': 'application/json',
                    'Api_key': process.env.NEYNAR_API_KEY
                },
                body: JSON.stringify(body)
              });
              var frameResult = await response.json();
              console.log(JSON.stringify(frameResult));
              return resolve(frameResult);
        }); // return new Promise
    }, // validate

    "imageFromText": async function(text) {
        return new Promise(async function(resolve, reject) { 
            const textToImage = new UltimateTextToImage(text, {
                width: 1024,
                height: 1024,
                fontSize: 72,
                lineHeight: 96,
                bold: 700,
                fontWeight: 700,
                margin: 80,
                borderSize: 40,
                borderColor: "#A36EFD",
                fontFamily: "Inter, Impact",
                backgroundColor: "#FFFFFF",
                align: "center",
                valign: "middle",
            }).render().toBuffer("image/png").toString("base64");
            console.log(textToImage);
            return resolve(`data:image/png;base64,${textToImage}`);
        }); // return new Promise
    }, // imageFromText

}; // module.exports
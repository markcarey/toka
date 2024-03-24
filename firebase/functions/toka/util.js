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

const Jimp = require('jimp');
const { Readable } = require('stream');
var FormData = require('form-data');

const {PubSub} = require("@google-cloud/pubsub");
const pubsub = new PubSub();

const degenJSON = require(__base + 'toka/abis/DEGEN.json');
const zora721JSON = require(__base + 'toka/abis/ERC721Drop.json');
const zora1155JSON = require(__base + 'toka/abis/Zora1155.json');
const zora1155FixedPriceJSON = require(__base + 'toka/abis/Zora1155FixedPrice.json');
const toka1155JSON = require(__base + 'toka/abis/TokaMint1155.json');
const toka721JSON = require(__base + 'toka/abis/TokaMint721.json');
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

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

    "hasAllowance": async function(state, address) {
        return new Promise(async function(resolve, reject) {
            const provider = new ethers.providers.JsonRpcProvider({"url": process.env.API_URL_BASE});
            const degen = new ethers.Contract(process.env.DEGEN_CONTRACT, degenJSON.abi, provider);
            var tokaAddress;
            if (state.contractType == "ERC1155") {
                tokaAddress = process.env.TOKA1155_ADDRESS;
            } else if (state.contractType == "ERC721") {
                tokaAddress = process.env.TOKA721_ADDRESS;
            }
            const allowance = await degen.allowance(address, tokaAddress);
            console.log("allowance", allowance);
            state.degenFee = ethers.BigNumber.from(state.degenFeeHex);
            if (allowance >= state.degenFee) {
                state.hasAllowance = true;
            } else {
                state.hasAllowance = false;
            }
            return resolve(state);
        }); // return new Promise
    }, // hasAllowance

    "hasPermission": async function(state) {
        return new Promise(async function(resolve, reject) {
            const provider = new ethers.providers.JsonRpcProvider({"url": process.env.API_URL_BASE});
            if (state.contractType == "ERC1155") {
                const zora1155 = new ethers.Contract(state.contractAddress, zora1155JSON.abi, provider);
                const role = await zora1155.PERMISSION_BIT_MINTER();
                const bits = await zora1155.permissions(0, process.env.TOKA1155_ADDRESS);
                console.log("bits", bits);
                if (bits > 0) {
                    state.hasPermission = true;
                } else {
                    state.hasPermission = false;
                }
            } else if (state.contractType == "ERC721") {
                const zora721 = new ethers.Contract(state.contractAddress, zora721JSON.abi, provider);
                const hasPermission = await zora721.hasRole(DEFAULT_ADMIN_ROLE, process.env.TOKA721_ADDRESS);
                state.hasPermission = hasPermission;
            }
            return resolve(state);
        }); // return new Promise
    }, // hasPermission

    "getDegenMintPrice": async function(state) {
        const util = module.exports;
        return new Promise(async function(resolve, reject) {
            const provider = new ethers.providers.JsonRpcProvider({"url": process.env.API_URL_BASE});
            // is contract ERC721 or ERC1155?
            // abi for getDegenMintPrice
            const abi = [ "function getDegenPricePerToken(address nft, uint256 tokenId) external view returns (uint256)" ];
            var tokaAddress;
            if (state.contractType == "ERC1155") {
                tokaAddress = process.env.TOKA1155_ADDRESS;
            } else if (state.contractType == "ERC721") {
                tokaAddress = process.env.TOKA721_ADDRESS;
            }
            const c = new ethers.Contract(tokaAddress, abi, provider);
            const price = await c.getDegenPricePerToken(state.contractAddress, state.tokenId);
            state.degenFee = price.add(ethers.utils.parseEther("420"));
            state.degenFeeHex = ethers.utils.hexlify(state.degenFee);
            return resolve(state);
        }); // return new Promise
    }, // getDegenMintPrice

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
                state.tokaAddress = process.env.TOKA721_ADDRESS;
                const zora721 = new ethers.Contract(state.contractAddress, zora721JSON.abi, provider);

                const feeData = await zora721.zoraFeeForAmount(1);
                var fee = feeData.fee;
                console.log("fee", fee);
                //now get price
                const salesConfig = await zora721.salesConfig();
                console.log("salesConfig", JSON.stringify(salesConfig));
                const price = salesConfig.publicSalePrice;
                console.log("price", price);
                // add the price to the fee
                fee = fee.add(price);
                // fee as hex
                const feeHex = ethers.utils.hexlify(fee);
                console.log("feeHex", feeHex);
                //console.log("fee from parse ether", ethers.utils.parseEther("0.000777")._hex);
                state.fee = fee;
                state.feeHex = feeHex;
            } else if (is1155) {
                state.contractType = "ERC1155";
                state.tokaAddress = process.env.TOKA1155_ADDRESS;
                const zora1155 = new ethers.Contract(state.contractAddress, zora1155JSON.abi, provider);
                // get the fee from the sales strategy contract
                const salesStrategy = new ethers.Contract(zoraAddresses.base.FIXED_PRICE_SALE_STRATEGY, zora1155FixedPriceJSON.abi, provider);
                const salesConfig = await salesStrategy.sale(state.contractAddress, state.tokenId ? state.tokenId : 1);
                console.log("salesConfig", JSON.stringify(salesConfig));
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

    "getUserFromContractAddress": async function(contractAddress) {
        const util = module.exports;
        return new Promise(async function(resolve, reject) {
            const provider = new ethers.providers.JsonRpcProvider({"url": process.env.API_URL_BASE});
            // abi for owner() returns address
            const abi = [ "function owner() external view returns (address)" ];
            const c = new ethers.Contract(contractAddress, abi, provider);
            const owner = await c.owner();
            console.log("owner", owner);
            var user;
            const users = await util.getFCUserbyAddress([owner]);
            if (owner in users) {
                //if (users[address].length == 1) {
                    user = users[address][0];
                //}
            }
            return resolve(user);
        }); // return new Promise
    }, // getUserFromContractAddress

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
                borderColor: "#0833FF",
                fontFamily: "Inter, Impact",
                backgroundColor: "#FFFFFF",
                align: "center",
                valign: "middle",
            }).render().toBuffer("image/png").toString("base64");
            console.log(textToImage);
            return resolve(`data:image/png;base64,${textToImage}`);
        }); // return new Promise
    }, // imageFromText

    "tokaImageFromText": async function(text, imageUrl) {
        return new Promise(async function(resolve, reject) {
            const nftImage = await getCanvasImage({"url": imageUrl});
            const textToImage = new UltimateTextToImage(text, {
                width: 1024,
                height: 1024,
                fontSize: 72,
                lineHeight: 96,
                bold: 700,
                fontWeight: 700,
                marginBottom: 80,
                marginLeft: 80,
                marginRight: 80,
                marginTop: 128 + 40,
                borderSize: 40,
                borderColor: "#0833FF",
                fontFamily: "Inter, Impact",
                backgroundColor: "#FFFFFF",
                align: "center",
                valign: "top",
                images: [
                    { canvasImage: nftImage,  layer: 0, repeat: "fit", x: 512 - 128, y: 128, width: 256, height: 256}
                ]
            }).render().toBuffer("image/png").toString("base64");
            console.log(textToImage);
            return resolve(`data:image/png;base64,${textToImage}`);
        }); // return new Promise
    }, // tokaImageFromText

    "frameHTML": async function(frame) {
        console.log("build html for frame", JSON.stringify(frame));
        const util = module.exports;
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
                    } // if link or tx
                    if ("post_url" in frame.buttons[i]) {
                        buttons += `<meta name="fc:frame:button:${i+1}:post_url" content="${frame.buttons[i].post_url}" />`;
                    } // if link or tx
                } // for
            } // if buttons
            var square = "";
            if ("image" in frame) {
                // do nothing, assumes image is already a data URI or URL
            } else {
                frame.square = true;
                if ("imageText" in frame) {
                    frame.image = await util.imageFromText(frame.imageText);
                } else {
                    frame.image = await util.imageFromText("404 - Image not found");
                } // if imageText
            } // if image
            if ("textField" in frame) {
                textField = `<meta name="fc:frame:input:text" content="${frame.textField}" />`;
            } // if textField
            console.log("frame.image", frame.image);
            if ("square" in frame) {
                if (frame.square == true) {
                    square = `<meta name="fc:frame:image:aspect_ratio" content="1:1" />`;
                } // if square
            } // if square
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
    }, // frameHTML

    "logFrame": async function(data) {
        return new Promise(async function(resolve, reject) {
            const topic = pubsub.topic('log-frame');
            const messageBody = JSON.stringify(data);
            const buffer = Buffer.from(messageBody);
            return topic.publishMessage({"data": buffer});
        }); // return new Promise
    }, // logFrame

    "logWebhook": async function(data) {
        return new Promise(async function(resolve, reject) {
            const topic = pubsub.topic('webhook');
            const messageBody = JSON.stringify(data);
            const buffer = Buffer.from(messageBody);
            return topic.publishMessage({"data": buffer});
        }); // return new Promise
    }, // logWebhook

    "logMint": async function(data) {
        return new Promise(async function(resolve, reject) {
            const topic = pubsub.topic('mint');
            const messageBody = JSON.stringify(data);
            const buffer = Buffer.from(messageBody);
            return topic.publishMessage({"data": buffer});
        }); // return new Promise
    } // logMint

}; // module.exports
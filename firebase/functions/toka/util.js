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

//import { parse } from 'node-html-parser'
const { parse } = require('node-html-parser');
const Jimp = require('jimp');
const { Readable } = require('stream');
var FormData = require('form-data');

const zora721JSON = require(__base + 'farcraft/ERC721Drop.json');
const zora1155JSON = require(__base + 'farcraft/Zora1155.json');
const zora1155FixedPriceJSON = require(__base + 'farcraft/Zora1155FixedPrice.json');

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
            console.log("contractAddress b4 supportsInterface", contractAddress);
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
            } else if (is1155) {
                state.contractType = "ERC1155";
                const zora1155 = new ethers.Contract(state.contractAddress, zora1155JSON.abi, provider);
                // get the fee from the sales strategy contract
                const salesStrategy = new ethers.Contract(zoraAddresses.base.FIXED_PRICE_SALE_STRATEGY, zora1155FixedPriceJSON.abi, provider);
                const salesConfig = await salesStrategy.sale(contractAddress, state.tokenId ? state.tokenId : 1);
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
            }
            return resolve(state);
        }); // return new Promise
    }, // getMintPrice

   
}; // module.exports
var functions = require('firebase-functions');
var firebase = require('firebase-admin');
var storage = firebase.storage();
const bucket = storage.bucket();
var db = firebase.firestore();

const fetch = require('node-fetch');
const {UltimateTextToImage} = require("ultimate-text-to-image");
var uniqid = require('uniqid');
const { ethers } = require("ethers");

var util = require(__base + 'toka/util');
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

function abbrAddress(address){
  return address.slice(0,4) + "..." + address.slice(address.length - 4);
}

module.exports = {

  "mint": async function(req) {
    return new Promise(async function(resolve, reject) {
      var frame = {};
      frame.id = req.params.id;
      frame.square = true;
      frame.postUrl = `https://toka.lol/collect/base:${req.params.address}`;

      const allowed = [8685,234616];
      var minterAddress;
      // TODO: remove this before launch -- is fid allowed?
      if (!allowed.includes(parseInt(req.body.untrustedData.fid))) {
        frame.imageText = "You are not authorized to use this frame ... yet.";
        return resolve(frame);
      } else {
        // validate to check
        const frameResult = await util.validate(req);
        if (frameResult.valid == false) {
          frame.imageText = "I'm sorry, I couldn't validate this frame.";
          return resolve(frame);
        }
        // get the users most recent verified eth address
        if ("verified_addresses" in frameResult.action.interactor) {
          if ("eth_addresses" in frameResult.action.interactor.verified_addresses) {
            minterAddress = frameResult.action.interactor.verified_addresses.eth_addresses[frameResult.action.interactor.verified_addresses.eth_addresses.length-1];
          }
        } // if verified_addresses
      } // if allowed

      var contractAddress = "0xae563f1AD15a52A043989c8c31f2ebD621272411"; // default
      var state;

      if (req.params.session) {
        console.log("req.params.address", req.params.address);
        if (req.params.address == "1") {
          // no-op
        } else {
          // does it seem like a contract address?
          if (req.params.address.length == 42) {
            contractAddress = req.params.address;
          }
        }
      }

      
      if ("state" in req.body.untrustedData) {
        state = JSON.parse(decodeURIComponent(req.body.untrustedData.state));
      } else {
        state = {
          "method": "start",
          "contractAddress": contractAddress
        };
      }
      console.log("state", state);
   
      if (state.method == "start") {
        frame.imageText = "try it";
        state = await util.getMintPrice(state);
        console.log("state after getting mint price", state);
        const price = state.fee;
        // format price in ether
        const priceEther = parseFloat(ethers.utils.formatEther(price)).toFixed(6);
        frame.buttons = [
          {
            "label": `Mint (${priceEther} ETH)`,
            "action": "tx",
            "target": `https://toka.lol/frames/${req.params.id}`
          }
        ];
        frame.image = `https://toka.lol/api/contract/images/base/${state.contractAddress}`;
        state.contractAddress = contractAddress;
        state.method = "mint";
      } else if (state.method == "mint") {
        if ("transactionId" in req.body.untrustedData) {
          // transaction completed
          const txnId = req.body.untrustedData.transactionId;
          frame.imageText = `Your txId is ${txnId}`;
          frame.buttons = [
            {
              "label": "Transaction",
              "action": "link",
              "target": `https://basescan.org/tx/${txnId}`
            }
          ];
        } else {
          // return tx data
          // ZoraDrop contract via ethers
          const provider = new ethers.providers.JsonRpcProvider(process.env.API_URL_BASE);
          if ("address" in req.body.untrustedData) {
            // connected wallet address
            minterAddress = req.body.untrustedData.address;
          }

          if (state.contractTye == "ERC721") {
            const zora721 = new ethers.Contract(state.contractAddress, zora721JSON.abi, provider);
            // calldata for a mint tx
            const feeHex = state.feeHex;
            const inputs = {
              "recipient": minterAddress,
              "quantity": 1,
              "comment": "so Based", // TODO: collect from inputText, or skip?
              "mintReferral": process.env.TOKA_ADDRESS
            }
            const calldata = zora721.interface.encodeFunctionData("mintWithRewards", [inputs.recipient, inputs.quantity, inputs.comment, inputs.mintReferral]);
            const tx = {
              "chainId": "eip155:8453", // Base chainId
              "method": "eth_sendTransaction",
              "params": {
                "to": zora721.address,
                "abi": zora721JSON.abi,
                "data": calldata,
                "value": feeHex
              }
            };
            return resolve(tx);
          } else if (state.contractType == "ERC1155") {
            const zora1155 = new ethers.Contract(state.contractAddress, zora1155JSON.abi, provider);
            // calldata for a mint tx
            const inputs = {
              "minter": zoraAddresses.base.FIXED_PRICE_SALE_STRATEGY,
              "recipient": minterAddress,
              "tokenId": 1, // TODO: update this to the token id
              "quantity": 1,
              "mintReferral": process.env.TOKA_ADDRESS
            }
            // convert inputs.recipient to bytes
            const recipientBytes = ethers.utils.defaultAbiCoder.encode(["address"], [inputs.recipient]);
            inputs.minterArguments = recipientBytes;
            const calldata = zora1155.interface.encodeFunctionData("mintWithRewards", [inputs.minter, inputs.tokenId, inputs.quantity, inputs.minterArguments, inputs.mintReferral]);
            const feeHex = state.feeHex;
            const tx = {
              "chainId": "eip155:8453", // Base chainId
              "method": "eth_sendTransaction",
              "params": {
                "to": zora1155.address,
                "abi": zora1155JSON.abi,
                "data": calldata,
                "value": feeHex
              }
            };
            return resolve(tx);
          } else {
            frame.imageText = "I'm sorry, I couldn't validate the contract address.";
          } // if is721
        } // if txnId
      } // if method
      frame.state = state;
      return resolve(frame);
    }); // return new Promise
  }, // aaaa


}; // module.exports
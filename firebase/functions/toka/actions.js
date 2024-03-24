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
const toka1155JSON = require(__base + 'toka/abis/TokaMint1155.json');
const toka721JSON = require(__base + 'toka/abis/TokaMint721.json');


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

const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

function abbrAddress(address){
  return address.slice(0,4) + "..." + address.slice(address.length - 4);
}

module.exports = {

  "admin": async function(req) {
    return new Promise(async function(resolve, reject) {
      var frame = {};
      frame.id = req.params.id;
      frame.square = true;
      frame.postUrl = `https://toka.lol/admin/base:${req.params.address}`;

      const allowed = [8685,234616];
      var adminAddress;
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
            adminAddress = frameResult.action.interactor.verified_addresses.eth_addresses[frameResult.action.interactor.verified_addresses.eth_addresses.length-1];
          }
        } // if verified_addresses
      } // if allowed

      var state = {};

      if (req.params.address) {
        console.log("req.params.address", req.params.address);
        if (req.params.address == "1") {
          // no-op
        } else {
          // does it seem like a contract address?
          if (req.params.address.length == 42) {
            state.contractAddress = req.params.address;
          }
        }
      }
      if (req.params.tokenId) {
        state.tokenId = req.params.tokenId;
      } else {
        state.tokenId = 1;
      }
      
      if ("state" in req.body.untrustedData) {
        state = JSON.parse(decodeURIComponent(req.body.untrustedData.state));
      } else {
        state.method = "start";
      }
      console.log("state", JSON.stringify(state));
      util.logFrame({"custom_id": state.contractAddress, "frame_id": "admin", "data": req.body});
   

      if (state.method == "start") {
        // have they alrewady granted permission?
        state = await util.getMintPrice(state);
        state = await util.hasPermission(state);
        if (state.hasPermission == true) {
          frame.imageText = `Enter a price in $DEGEN per mint, on top of the 420 mint fee`;
          frame.textField = "0";
          frame.buttons = [
            {
              "label": "Set Price",
              "action": "tx",
              "target": `https://toka.lol/admin/base:${state.contractAddress}`
            }
          ];
          state.method = "setPrice";
        } else {
          // offer option to enable mintWithDegen with 2 steps: assign permission, set price
          frame.imageText = "To enable Mint-with-DEGEN, grant minting authorization to Toka";
          frame.buttons = [
            {
              "label": "Authorize",
              "action": "tx",
              "target": `https://toka.lol/admin/base:${state.contractAddress}`
            }
          ];
          state.method = "grant";
        }
      } else if (state.method == "grant") {
        if ("transactionId" in req.body.untrustedData) {
          // transaction completed
          const txnId = req.body.untrustedData.transactionId;
          state.hasPermission = true;
          // TODO: handle this
          frame.imageText = `Now set you price in $DEGEN per mint, on top of the 420 mint fee`;
          frame.textField = "0";
          frame.buttons = [
            {
              "label": "Set Price",
              "action": "tx",
              "target": `https://toka.lol/admin/base:${state.contractAddress}`
            }
          ];
          state.method = "setPrice";
        } else {
          // return tx data
          // the following gets use contractType too
          if ("contractType" in state) {
            // no-op
          } else {
            state = await util.getMintPrice(state);
          }
          if (state.contractType == "ERC1155") {
            // ZoraDrop contract via ethers
            const provider = new ethers.providers.JsonRpcProvider(process.env.API_URL_BASE);
            if ("address" in req.body.untrustedData) {
              // connected wallet address
              adminAddress = req.body.untrustedData.address;
            }
            const zora1155 = new ethers.Contract(state.contractAddress, zora1155JSON.abi, provider);
            const role = await zora1155.PERMISSION_BIT_MINTER();
            console.log("role", role);  
            const tx = {
              "chainId": "eip155:8453", // Base chainId
              "method": "eth_sendTransaction",
              "params": {
                "to": zora1155.address,
                "abi": zora1155JSON.abi,
                "data": zora1155.interface.encodeFunctionData("addPermission", ["0", process.env.TOKA1155_ADDRESS, role])
              }
            };
            return resolve(tx);

          } else if (state.contractType == "ERC721") {
            // ZoraDrop contract via ethers
            const provider = new ethers.providers.JsonRpcProvider(process.env.API_URL_BASE);
            if ("address" in req.body.untrustedData) {
              // connected wallet address
              adminAddress = req.body.untrustedData.address;
            }
            const zora721 = new ethers.Contract(state.contractAddress, zora721JSON.abi, provider);
            const tx = {
              "chainId": "eip155:8453", // Base chainId
              "method": "eth_sendTransaction",
              "params": {
                "to": zora721.address,
                "abi": zora721JSON.abi,
                "data": zora721.interface.encodeFunctionData("grantRole", [DEFAULT_ADMIN_ROLE, process.env.TOKA721_ADDRESS])
              }
            };
            return resolve(tx);
          } // if contractType


        } // if txnId

      } else if (state.method == "setPrice") {
        if ("transactionId" in req.body.untrustedData) {
          // transaction completed
          const txnId = req.body.untrustedData.transactionId;
          // TODO: handle this
          frame.imageText = `Your txId is ${txnId}`;
        } else {
          // return tx data
          // ZoraDrop contract via ethers
          const provider = new ethers.providers.JsonRpcProvider(process.env.API_URL_BASE);
          var toka;
          if (state.contractType == "ERC1155") {
            toka = new ethers.Contract(process.env.TOKA1155_ADDRESS, toka1155JSON.abi, provider);
          } else if (state.contractType == "ERC721") {
            toka = new ethers.Contract(process.env.TOKA721_ADDRESS, toka721JSON.abi, provider);
          }
          // price from inputText
          const price = ethers.utils.parseEther(req.body.untrustedData.inputText);
          console.log("price", price);
          const tx = {
            "chainId": "eip155:8453", // Base chainId
            "method": "eth_sendTransaction",
            "attribution": false,
            "params": {
              "to": toka.address,
              "abi": toka.interface.abi,
              "data": toka.interface.encodeFunctionData("setDegenPricePerToken", [state.contractAddress, 1, price])
            }
          };
          return resolve(tx);
        } // if txnId

      } // if method
      frame.state = state;
      return resolve(frame);
    }); // return new Promise 
  }, // admin

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
      var state = {};

      if (req.params.address) {
        console.log("req.params.address", req.params.address);
        if (req.params.address == "1") {
          // no-op
        } else {
          // does it seem like a contract address?
          if (req.params.address.length == 42) {
            state.contractAddress = req.params.address;
          }
        }
      }
      if (req.params.tokenId) {
        state.tokenId = req.params.tokenId;
      } else {
        state.tokenId = 1;
      }
      
      if ("state" in req.body.untrustedData) {
        state = JSON.parse(decodeURIComponent(req.body.untrustedData.state));
      } else {
        state.method = "start";
      }
      console.log("state", state);
      util.logFrame({"custom_id": state.contractAddress, "frame_id": "mint", "data": req.body});
   
      if (state.method == "start") {
        frame.imageText = "try it";
        state = await util.getMintPrice(state);
        state = await util.getDegenMintPrice(state);
        state = await util.hasAllowance(state, minterAddress);
        console.log("state after getting mint price", state);
        const price = state.fee;
        // format price in ether
        const priceEther = parseFloat(ethers.utils.formatEther(price)).toFixed(6);
        const degenPriceEther = parseFloat(ethers.utils.formatEther(state.degenFee)).toFixed(0);
        frame.buttons = [
          {
            "label": `Approve (${degenPriceEther} $DEGEN)`,
            "action": "tx",
            "target": `https://toka.lol/collect/base:${state.contractAddress}`
          },
          {
            "label": `Mint (${priceEther} ETH)`,
            "action": "tx",
            "target": `https://toka.lol/collect/base:${state.contractAddress}`
          }
        ];
        if (state.hasAllowance == true) {
          frame.buttons[0] = {
            "label": `Mint (${degenPriceEther} $DEGEN)`,
            "action": "tx",
            "target": `https://toka.lol/collect/base:${state.contractAddress}`
          };
        }
        frame.image = `https://toka.lol/api/contract/images/base/${state.contractAddress}`;
        state.method = "mint";
      } else if (state.method == "mint") {
        if ("transactionId" in req.body.untrustedData) {
          console.log("transactionId buttonIndex", req.body.untrustedData.buttonIndex);
          if (req.body.untrustedData.buttonIndex == 2) {
            // mint with eth -- mint txn completed
            // transaction completed
            const txnId = req.body.untrustedData.transactionId;
            // TODO: nicer image / message
            frame.imageText = `Minted with ETH. Your txId is ${txnId}`;
            frame.buttons = [
              {
                "label": "Transaction",
                "action": "link",
                "target": `https://basescan.org/tx/${txnId}`
              }
            ];
          } else if (req.body.untrustedData.buttonIndex == 1) {
            // approve degen txn completed
            // transaction completed
            const txnId = req.body.untrustedData.transactionId;
            if ( state.hasAllowance == true ) {
              // the txn was actually a mint with Degen
              // TODO: nicer image / message that they can cast to share
              frame.imageText = `Minted with $DEGEN. Your txId is ${txnId}`;
              frame.buttons = [
                {
                  "label": "Transaction",
                  "action": "link",
                  "target": `https://basescan.org/tx/${txnId}`
                }
              ];
              state.method = "minted";
            } else {
              // the txn was actually an approve
              state.hasAllowance = true;
              frame.imageText = `Approved $DEGEN. Your txId is ${txnId}. Now mint.`;
              // get degen fee in ether from state.feeHex
              console.log("state.degenFeeHex", state.degenFeeHex);
              state.degenFee = ethers.BigNumber.from(state.degenFeeHex);
              console.log("state.degenFee", state.degenFee);
              const degenPriceEther = parseFloat(ethers.utils.formatEther(state.degenFee)).toFixed(0);
              frame.buttons = [
                {
                  "label": `Mint (${degenPriceEther} $DEGEN)`,
                  "action": "tx",
                  "target": `https://toka.lol/collect/base:${state.contractAddress}`
                }
              ];
              state.method = "mintWithDegen";
            }

          }
        } else {
          // return tx data
          // ZoraDrop contract via ethers
          const provider = new ethers.providers.JsonRpcProvider(process.env.API_URL_BASE);
          if ("address" in req.body.untrustedData) {
            // connected wallet address
            minterAddress = req.body.untrustedData.address;
          }

          // Mint with ETH - if buttonIndex == 2
          if (req.body.untrustedData.buttonIndex == 2) {

            if (state.contractType == "ERC721") {
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
          } else if (req.body.untrustedData.buttonIndex == 1) {
            if (state.hasAllowance == true) {
              // mint with Degen
              var abi;
              if (state.contractType == "ERC1155") {
                abi = toka1155JSON.abi;
              } else if (state.contractType == "ERC721") {
                abi = toka721JSON.abi;
              }
              const toka = new ethers.Contract(state.tokaAddress, abi, provider);
              const calldata = toka.interface.encodeFunctionData("mintWithDegen", [minterAddress, state.contractAddress, state.tokenId, 1]);
              var value = "0x0";
              const tx = {
                "chainId": "eip155:8453", // Base chainId
                "method": "eth_sendTransaction",
                "params": {
                  "to": toka.address,
                  "abi": toka.interface.abi,
                  "data": calldata,
                  "value": value
                }
              };
              return resolve(tx);
            } else {
              // Approve $DEGEN
              const degen = new ethers.Contract(process.env.DEGEN_CONTRACT, degenJSON.abi, provider);
              const feeHex = state.degenFeeHex;
              const tx = {
                "chainId": "eip155:8453", // Base chainId
                "method": "eth_sendTransaction",
                "attribution": false,
                "params": {
                  "to": degen.address,
                  "abi": degen.interface.abi,
                  "data": degen.interface.encodeFunctionData("approve", [state.tokaAddress, state.degenFeeHex])
                }
              };
              return resolve(tx);
            } // if hasAllowance
          } // if buttonIndex
        } // if txnId
      } else if (state.method == "mintWithDegen") {
        if ("transactionId" in req.body.untrustedData) {
          // transaction completed
          const txnId = req.body.untrustedData.transactionId;
          // mint with Degn txn completed
          frame.imageText = `Minted with $DEGEN. Your txId is ${txnId}`;
          frame.buttons = [
            {
              "label": "Transaction",
              "action": "link",
              "target": `https://basescan.org/tx/${txnId}`
            }
          ];
        } else {
          // return tx data to mint with Degen
          const provider = new ethers.providers.JsonRpcProvider(process.env.API_URL_BASE);
          if ("address" in req.body.untrustedData) {
            // connected wallet address
            minterAddress = req.body.untrustedData.address;
          }
          // abi for mintWithDegen
          var abi;
          if (state.contractType == "ERC1155") {
            abi = toka1155JSON.abi;
          } else if (state.contractType == "ERC721") {
            abi = toka721JSON.abi;
          }
          const c = new ethers.Contract(state.tokaAddress, abi, provider);
          const calldata = c.interface.encodeFunctionData("mintWithDegen", [minterAddress, state.contractAddress, state.tokenId, 1]);
          var value = "0x0";
          state = await util.hasPermission(state);
          if (state.hasPermission == true) {
            // no-op
          } else {
            //value = state.feeHex;
          }
          const tx = {
            "chainId": "eip155:8453", // Base chainId
            "method": "eth_sendTransaction",
            "params": {
              "to": c.address,
              "abi": c.interface.abi,
              "data": calldata,
              "value": value
            }
          };
          return resolve(tx);
        } 
      } // if method
      frame.state = state;
      return resolve(frame);
    }); // return new Promise
  }, // aaaa


}; // module.exports
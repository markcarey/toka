module.exports = {

    "mint": async function(req) {
        return new Promise(async function(resolve, reject) {
          var frame = {};
          frame.id = req.params.id;
          frame.square = true;
          frame.postUrl = `https://frm.lol/frames/${req.params.id}`;
    
          const allowed = [8685,234616];
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
          }
    
          var contractAddress = "0xae563f1AD15a52A043989c8c31f2ebD621272411"; // default
          var state;
    
          if (req.params.session) {
            console.log("req.params.session", req.params.session);
            if (req.params.session == "1") {
              // no-op
            } else {
              // does it seem like a contract address?
              if (req.params.session.length == 42) {
                contractAddress = req.params.session;
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
            frame.buttons = [
              {
                "label": "Mint",
                "action": "tx",
                "target": `https://frm.lol/frames/${req.params.id}`
              }
            ];
            frame.image = `https://frm.lol/api/contract/images/base/${state.contractAddress}`
            frame.postUrl = `https://frm.lol/frames/${req.params.id}/${state.contractAddress}`;
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
    
              // is contract ERC721 or ERC1155?
              const abi = [ "function supportsInterface(bytes4 interfaceId) external view returns (bool)" ];
              console.log("contractAddress b4 supportsInterface", contractAddress);
              const c = new ethers.Contract(state.contractAddress, abi, provider);
              const is721 = await c.supportsInterface("0x80ac58cd");
              console.log("is721", is721);
              const is1155 = await c.supportsInterface("0xd9b67a26");
              console.log("is1155", is1155);
    
              if (is721) {
                const zora721 = new ethers.Contract(state.contractAddress, zora721JSON.abi, provider);
    
                const feeData = await zora721.zoraFeeForAmount(1);
                const fee = feeData.fee;
                console.log("fee", fee);
                // fee as hex
                const feeHex = ethers.utils.hexlify(fee);
                console.log("feeHex", feeHex);
                console.log("fee from parse ether", ethers.utils.parseEther("0.000777")._hex);
                
                // calldata for a mint tx
                const inputs = {
                  "recipient": "0x09A900eB2ff6e9AcA12d4d1a396DdC9bE0307661", // TODO: update this to user's verified eth address
                  "quantity": 1,
                  "comment": "so Based",
                  "mintReferral": "0x1E58b6ab55cAfD3b6E0c3227844Ff4A011A6ac41" // toka
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
              } else if (is1155) {
                const zora1155 = new ethers.Contract(state.contractAddress, zora1155JSON.abi, provider);
                // calldata for a mint tx
                const inputs = {
                  "minter": zoraAddresses.base.FIXED_PRICE_SALE_STRATEGY,
                  "recipient": "0x09A900eB2ff6e9AcA12d4d1a396DdC9bE0307661", // TODO: update this to user's verified eth address
                  "tokenId": 1, // TODO: update this to the token id
                  "quantity": 1,
                  "mintReferral": "0x1E58b6ab55cAfD3b6E0c3227844Ff4A011A6ac41" // toka
                }
                // convert inputs.recipient to bytes
                const recipientBytes = ethers.utils.defaultAbiCoder.encode(["address"], [inputs.recipient]);
                inputs.minterArguments = recipientBytes;
                const calldata = zora1155.interface.encodeFunctionData("mintWithRewards", [inputs.minter, inputs.tokenId, inputs.quantity, inputs.minterArguments, inputs.mintReferral]);
                // get the fee from the sales strategy contract
                const salesStrategy = new ethers.Contract(zoraAddresses.base.FIXED_PRICE_SALE_STRATEGY, zora1155FixedPriceJSON.abi, provider);
                const salesConfig = await salesStrategy.sale(contractAddress, inputs.tokenId);
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
              } else {
                frame.imageText = "I'm sorry, I couldn't validate the contract address.";
              } // if is721
            } // if txnId
          } // if method
          frame.state = state;
          return resolve(frame);
        }); // return new Promise
      }, // aaaa

};


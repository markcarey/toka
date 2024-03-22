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
  
        var state;
        if ("state" in req.body.untrustedData) {
          state = JSON.parse(decodeURIComponent(req.body.untrustedData.state));
        } else {
          state = {
            "method": "start"
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
  
          // TODO: fetch metadata from the contract
          // ZoraDrop contract via ethers
          const provider = new ethers.providers.JsonRpcProvider(process.env.API_URL_BASE);
          const zora721 = new ethers.Contract("0xae563f1AD15a52A043989c8c31f2ebD621272411", zora721JSON.abi, provider);
          const metadata = await zora721.contractURI();
          console.log("metadata", metadata);
          //decode from base64 json
          const decodedMetadata = JSON.parse(Buffer.from(metadata.split(",")[1], 'base64').toString('utf-8'));
          
  
  
          //const decodedMetadata = JSON.parse(metadata.split(",")[1]);
          //console.log("decodedMetadata", decodedMetadata);
          // get the image
          var image = decodedMetadata.image;
          if (image.startsWith("ipfs://")) {
            // fetch from ipfs
            image = `https://ipfs.decentralized-content.com/ipfs/${image.replace("ipfs://", "")}`;
          }
          //const imageResponse = await fetch(image);
          //const imageBuffer = await imageResponse.buffer();
          //const imageBase64 = imageBuffer.toString('base64');
          //const mimetype = imageResponse.headers.get('content-type');
          //console.log("mimetype", mimetype);
          //frame.image = `data:${mimetype};base64,${imageBase64}`;
          frame.image = image;
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
            const zora721 = new ethers.Contract("0xae563f1AD15a52A043989c8c31f2ebD621272411", zora721JSON.abi, provider);
  
            const feeData = await zora721.zoraFeeForAmount(1);
            const fee = feeData.fee;
            console.log("fee", fee);
            // fee as hex
            const feeHex = ethers.utils.hexlify(fee);
            console.log("feeHex", feeHex);
            console.log("fee from parse ether", ethers.utils.parseEther("0.000777")._hex);
            
            // calldata for a mint tx
            const inputs = {
              "recipient": "0x09A900eB2ff6e9AcA12d4d1a396DdC9bE0307661",
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
                "value": ethers.utils.parseEther("0.000777")._hex
              }
            };
            return resolve(tx);
          } // if txnId
        } // if method
        frame.state = state;
        return resolve(frame);
      }); // return new Promise
    }, // aaaa

};


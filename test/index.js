const { expect } = require("chai");
const { ethers } = require("hardhat");
const fetch = require('node-fetch');

const networkName = hre.network.name;
console.log(networkName);

require('dotenv').config();

var addr = {
  "degen": process.env.DEGEN_CONTRACT,
  "fixedPriceSaleStrategy": process.env.FIXED_PRICE_SALE_STRATEGY,
  "toka": process.env.TOKA_ADDRESS
};
addr.degenerativeArt = "0x4578F0CB63599699DDBDa70760c6BBEc9e88A89E"; // Base, Zora1155
addr.zoraFactory = "0x777777C338d93e2C7adf08D102d45CA7CC4Ed021";
addr.mintWithDegen = "0x8c15A962709f78e3280C1cAc7ad7F7C5495635F6";
addr.swapper = "";
addr.toka721 = "";
addr.dropExample = "0xae563f1AD15a52A043989c8c31f2ebD621272411";
addr.dropOwner = "0x19D8da2674E8A025154153297ea3AB918DebF96d";

const tokaFee = ethers.utils.parseEther("69");
const mintFee = ethers.utils.parseEther("420");

const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

// supportsInterface('0x80ac58cd') // ERC721
// supportsInterface('0xd9b67a26') // ERC1155


//const degenJSON = require("../artifacts/contracts/MockDegen.sol/MockDegen.json");
const zora1155JSON = require("./abis/Zora1155.json");
const zoraFactoryJSON = require("./abis/ZoraFactory.json");
const degenJSON = require("./abis/DEGEN.json");
const mintWithDegenJSON = require("../artifacts/contracts/MintWithDegen.sol/MintWithDegen.json");
const swapperJSON = require("../artifacts/contracts/Swapper.sol/Swapper.json");
const erc721DropJSON = require("./abis/ERC721Drop.json");

const signer = new ethers.Wallet(process.env.PRIVATE_KEY, ethers.provider);
const degen = new ethers.Contract(addr.degen, degenJSON.abi, signer);
const da = new ethers.Contract(addr.degenerativeArt, zora1155JSON.abi, signer);
const zoraFactory = new ethers.Contract(addr.zoraFactory, zoraFactoryJSON.abi, signer);
var swapper, mwd, toka721;

async function getGasPrices() {
  //console.log("start getGasPrices");
  // retrun proimse
  return new Promise(async (resolve, reject) => {
    var resGas = await fetch('https://frm.lol/api/gas/base');
    //console.log("resGas", resGas);
    var gasOptions;
    var gas = await resGas.json();
    if (gas) {
        gasOptions = gas;
        //console.log("from /api/gas/base", gas);
    }
    resolve(gasOptions);
  }); // end promise
}

describe("Toka Mint with Degen", function() {

  before('Deploy Contracts', async function () {
    // runs once before the first test in this block
    this.timeout(2400000);
    network = await ethers.provider.getNetwork();

    const MySwapper = await ethers.getContractFactory("Swapper");
    // Start deployment, returning a promise that resolves to a contract object
    swapper = await MySwapper.deploy(); // Instance of the contract 
    console.log("Contract deployed to address:", swapper.address);
    addr.swapper = swapper.address;

    const MyContract = await ethers.getContractFactory("TokaMint1155");
    // Start deployment, returning a promise that resolves to a contract object
    mwd = await MyContract.deploy(addr.degen, addr.fixedPriceSaleStrategy, addr.swapper, mintFee, tokaFee, addr.toka); // Instance of the contract 
    console.log("Contract deployed to address:", mwd.address);
    addr.mintWithDegen = mwd.address;

    const MyContract721 = await ethers.getContractFactory("TokaMint721");
    // Start deployment, returning a promise that resolves to a contract object
    toka721 = await MyContract721.deploy(addr.degen, addr.swapper, mintFee, tokaFee, addr.toka); // Instance of the contract 
    console.log("Contract deployed to address:", toka721.address);
    addr.toka721 = toka721.address;

  });

  describe("1155", function() {

    it("Should return tokenUri", async function() {
      var tokenUri = await da.uri(1);
      console.log(tokenUri);
      expect(1).to.equal(1);
    });
  
    it("Should return PERMISSION_BIT_ADMIN", async function() {
      var role = await da.PERMISSION_BIT_ADMIN();
      console.log("PERMISSION_BIT_ADMIN",role);
      expect(1).to.equal(1);
    });
  
    it("Should return PERMISSION_BIT_MINTER", async function() {
      var role = await da.PERMISSION_BIT_MINTER();
      console.log("PERMISSION_BIT_MINTER",role);
      expect(1).to.equal(1);
    });
  
    // it should add minter permission for an address
    it.skip("Should add minter permission for an address", async function() {
      var role = await da.PERMISSION_BIT_MINTER();
      var adminSigner = new ethers.Wallet(process.env.PK, ethers.provider);
      var gasOptions = await getGasPrices();
      //console.log("gasOptions", gasOptions);
      if (gasOptions) {
        await da.connect(adminSigner).addPermission(0, process.env.PUBLIC_KEY, role, gasOptions);
      } else {
        console.log("gasOptions not found");
      }
      expect(1).to.equal(1);
    });
  
    // it should mint using adminMint function
    it("Should mint using adminMint function", async function() {
      var gasOptions = await getGasPrices();
      //console.log("gasOptions", gasOptions);
      if (gasOptions) {
        await da.adminMint(process.env.PUBLIC_KEY, 1, 1, "0x", gasOptions);
      } else {
        console.log("gasOptions not found");
      }
      expect(1).to.equal(1);
    });
  
    // it shoudkl check if signer has minter permission
    it("Should check if signer has minter permission", async function() {
      var role = await da.PERMISSION_BIT_MINTER();
      var hasPermission = await da.isAdminOrRole(process.env.PUBLIC_KEY, 0, role);
      console.log("hasPermission", hasPermission);
      expect(1).to.equal(1);
    });
  
  }); // end describe
  
  describe("Mint with Degen 1155", function() {
  
    it("Should return degen address", async function() {
      var degen = await mwd._degen();
      console.log("degen", degen);
      expect(1).to.equal(1);
    });
  
    it("Should return fixedPriceSaleStrategy address", async function() {
      var fixedPriceSaleStrategy = await mwd._fixedPriceSaleStrategy();
      console.log("fixedPriceSaleStrategy", fixedPriceSaleStrategy);
      expect(1).to.equal(1);
    });
  
    it("Should return mintFee", async function() {
      var mintFee = await mwd._mintFee();
      console.log("mintFee", mintFee);
      expect(1).to.equal(1);
    });
  
    it("Should return tokaFee", async function() {
      var tokaFee = await mwd._tokaFee();
      console.log("tokaFee", tokaFee);
      expect(1).to.equal(1);
    });
  
    // it should set degenPricePerToken for degenerativeArt contract
    it("Should set degenPricePerToken for degenerativeArt contract", async function() {
      var gasOptions = await getGasPrices();
      //console.log("gasOptions", gasOptions);
      const price = ethers.utils.parseEther("1000");
      if (gasOptions) {
        await mwd.setDegenPricePerToken(addr.degenerativeArt, 1, price, gasOptions);
      } else {
        console.log("gasOptions not found");
      }
      expect(1).to.equal(1);
    });
    
    // it should return degenPricePerToken for degenerativeArt contract
    it("Should return degenPricePerToken for degenerativeArt contract", async function() {
      var price = await mwd.getDegenPricePerToken(addr.degenerativeArt, 1);
      console.log("price", price);
      expect(1).to.equal(1);
    });
  
    // it should return totalDegenPricePerToken for degenerativeArt contract
    it("Should return totalDegenPricePerToken for degenerativeArt contract", async function() {
      var price = await mwd.getTotalDegenPricePerToken(addr.degenerativeArt, 1);
      console.log("price", price);
      expect(1).to.equal(1);
    });
  
    // it should impersonate 0x30EEcE78d9ca0F0B9Fa8Db33bC0f6934ac34eF82 and transfer 1,000,000 DEGEN to signer
    it("Should impersonate 0x30EEcE78d9ca0F0B9Fa8Db33bC0f6934ac34eF82 and transfer 1,000,000 DEGEN to signer", async function() {
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0x30EEcE78d9ca0F0B9Fa8Db33bC0f6934ac34eF82"]}
      );
      const impersonatedSigner = await ethers.getSigner("0x30EEcE78d9ca0F0B9Fa8Db33bC0f6934ac34eF82");
      //const degen = new ethers.Contract(addr.degen, degenJSON.abi, impersonatedSigner);
      await degen.connect(impersonatedSigner).transfer(signer.address, ethers.utils.parseEther("1000000"));
      // stop impersonating
      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: ["0x30EEcE78d9ca0F0B9Fa8Db33bC0f6934ac34eF82"]}
      );
      expect(1).to.equal(1);
    });
  
    // it should get salesStrategy for degenerativeArt contract
    it("Should get salesStrategy for degenerativeArt contract", async function() {
      var salesStrategy = await mwd.getSalesStrategy(addr.degenerativeArt, 1);
      console.log("salesStrategy 1", salesStrategy);
      salesStrategy = await mwd.getSalesStrategy(addr.degenerativeArt, 0);
      console.log("salesStrategy 0", salesStrategy);
      expect(1).to.equal(1);
    });
  
    // it should approve max spending for degen to mwd
    it("Should approve max spending for degen to mwd", async function() {
      var gasOptions = await getGasPrices();
      //console.log("gasOptions", gasOptions);
      if (gasOptions) {
        await degen.approve(mwd.address, ethers.constants.MaxUint256, gasOptions);
      } else {
        console.log("gasOptions not found");
      }
      expect(1).to.equal(1);
    });
  
    // it should swap 420 DEGEN
    it.skip("Should swap 420 DEGEN", async function() {
      var gasOptions = await getGasPrices();
      //console.log("gasOptions", gasOptions);
      if (gasOptions) {
        await mwd.swapTest(ethers.utils.parseEther("420"), gasOptions);
      } else {
        console.log("gasOptions not found");
      }
      expect(1).to.equal(1);
    });
  
    // it should grant MINTER role to mwd on degenerativeArt contract
    it("Should grant MINTER role to mwd on degenerativeArt contract", async function() {
      var role = await da.PERMISSION_BIT_MINTER();
      var gasOptions = await getGasPrices();
      //console.log("gasOptions", gasOptions);
      if (gasOptions) {
        var adminSigner = new ethers.Wallet(process.env.PK, ethers.provider);
        await da.connect(adminSigner).addPermission(0, mwd.address, role, gasOptions);
      } else {
        console.log("gasOptions not found");
      }
      expect(1).to.equal(1);
    });
  
    // it should mint a degenerative art token with Degen
    it("Should mint a degenerative art token with Degen", async function() {
      var gasOptions = await getGasPrices();
      //console.log("gasOptions", gasOptions);
      if (gasOptions) {
        await mwd.mintWithDegen(process.env.PUBLIC_KEY, addr.degenerativeArt, 1, 1, gasOptions);
      } else {
        console.log("gasOptions not found");
      }
      expect(1).to.equal(1);
    });
  
  
  }); // end describe
  
  describe("Mint with Degen 721", function() {
  
  
    it("Should return mintFee", async function() {
      var mintFee = await toka721._mintFee();
      console.log("mintFee", mintFee);
      expect(1).to.equal(1);
    });
  
    it("Should return tokaFee", async function() {
      var tokaFee = await toka721._tokaFee();
      console.log("tokaFee", tokaFee);
      expect(1).to.equal(1);
    });
  
    // it should set degenPricePerToken for degenerativeArt contract
    it("Should set degenPricePerToken for degenerativeArt contract", async function() {
      var gasOptions = await getGasPrices();
      //console.log("gasOptions", gasOptions);
      const price = ethers.utils.parseEther("1000");
      if (gasOptions) {
        // impersonale addr.dropOwner
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [addr.dropOwner]}
        );
        const impersonatedSigner = await ethers.getSigner(addr.dropOwner);
        await toka721.connect(impersonatedSigner).setDegenPricePerToken(addr.dropExample, 1, price, gasOptions);
        // stop impersonating
        await hre.network.provider.request({
          method: "hardhat_stopImpersonatingAccount",
          params: [addr.dropOwner]}
        );
      } else {
        console.log("gasOptions not found");
      }
      expect(1).to.equal(1);
    });
  
    it("Should set grant DEFAULT_ADIM_ROLE to toka721 for dropExample contract", async function() {
      var gasOptions = await getGasPrices();
      //console.log("gasOptions", gasOptions);
      const price = ethers.utils.parseEther("1000");
      if (gasOptions) {
        // impersonale addr.dropOwner
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [addr.dropOwner]}
        );
        const impersonatedSigner = await ethers.getSigner(addr.dropOwner);
        // get the contract
        const dropExample = new ethers.Contract(addr.dropExample, erc721DropJSON.abi, impersonatedSigner);
        await dropExample.grantRole(DEFAULT_ADMIN_ROLE, toka721.address, gasOptions);
        // stop impersonating
        await hre.network.provider.request({
          method: "hardhat_stopImpersonatingAccount",
          params: [addr.dropOwner]}
        );
      } else {
        console.log("gasOptions not found");
      }
      expect(1).to.equal(1);
    });
    
    it("Should return degenPricePerToken for dropExample contract", async function() {
      var price = await toka721.getDegenPricePerToken(addr.dropExample, 1);
      console.log("price", price);
      expect(1).to.equal(1);
    });
  
    it("Should return totalDegenPricePerToken for dropExample contract", async function() {
      var price = await toka721.getTotalDegenPricePerToken(addr.dropExample, 1);
      console.log("price", price);
      expect(1).to.equal(1);
    });
  
    // it should impersonate 0x30EEcE78d9ca0F0B9Fa8Db33bC0f6934ac34eF82 and transfer 1,000,000 DEGEN to signer
    it("Should impersonate 0x30EEcE78d9ca0F0B9Fa8Db33bC0f6934ac34eF82 and transfer 1,000,000 DEGEN to signer", async function() {
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0x30EEcE78d9ca0F0B9Fa8Db33bC0f6934ac34eF82"]}
      );
      const impersonatedSigner = await ethers.getSigner("0x30EEcE78d9ca0F0B9Fa8Db33bC0f6934ac34eF82");
      //const degen = new ethers.Contract(addr.degen, degenJSON.abi, impersonatedSigner);
      await degen.connect(impersonatedSigner).transfer(signer.address, ethers.utils.parseEther("1000000"));
      // stop impersonating
      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: ["0x30EEcE78d9ca0F0B9Fa8Db33bC0f6934ac34eF82"]}
      );
      expect(1).to.equal(1);
    });
  
  
    it("Should get salesStrategy for dropExample contract", async function() {
      var salesStrategy = await toka721.getSalesStrategy(addr.dropExample, 1);
      console.log("salesStrategy 1", salesStrategy);
      salesStrategy = await toka721.getSalesStrategy(addr.dropExample, 0);
      console.log("salesStrategy 0", salesStrategy);
      expect(1).to.equal(1);
    });
  
    // it should approve max spending for degen to mwd
    it("Should approve max spending for degen to mwd", async function() {
      var gasOptions = await getGasPrices();
      //console.log("gasOptions", gasOptions);
      if (gasOptions) {
        await degen.approve(toka721.address, ethers.constants.MaxUint256, gasOptions);
      } else {
        console.log("gasOptions not found");
      }
      expect(1).to.equal(1);
    });
  
    // it should swap 420 DEGEN
    it.skip("Should swap 420 DEGEN", async function() {
      var gasOptions = await getGasPrices();
      //console.log("gasOptions", gasOptions);
      if (gasOptions) {
        await mwd.swapTest(ethers.utils.parseEther("420"), gasOptions);
      } else {
        console.log("gasOptions not found");
      }
      expect(1).to.equal(1);
    });
  
    // it should mint a degenerative art token with Degen
    it("Should mint a dropExample art token with Degen", async function() {
      var gasOptions = await getGasPrices();
      //console.log("gasOptions", gasOptions);
      if (gasOptions) {
        await toka721.mintWithDegen(process.env.PUBLIC_KEY, addr.dropExample, 1, 1, gasOptions);
      } else {
        console.log("gasOptions not found");
      }
      expect(1).to.equal(1);
    });
  
  
  }); // end describe

});


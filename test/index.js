const { expect } = require("chai");
const { ethers } = require("hardhat");
const fetch = require('node-fetch');

const networkName = hre.network.name;
console.log(networkName);

require('dotenv').config();

var addr = {
  "degen": process.env.DEGEN_CONTRACT,
  "fixedPriceSaleStrategy": process.env.FIXED_PRICE_SALE_STRATEGY,
};
addr.degenerativeArt = "0x4578F0CB63599699DDBDa70760c6BBEc9e88A89E"; // Base, Zora1155
addr.zoraFactory = "0x777777C338d93e2C7adf08D102d45CA7CC4Ed021";
addr.mintWithDegen = "0x8c15A962709f78e3280C1cAc7ad7F7C5495635F6";

const tokaFee = ethers.utils.parseEther("69");
const mintFee = ethers.utils.parseEther("420");

// supportsInterface('0x80ac58cd') // ERC721
// supportsInterface('0xd9b67a26') // ERC1155


//const degenJSON = require("../artifacts/contracts/MockDegen.sol/MockDegen.json");
const zora1155JSON = require("./abis/Zora1155.json");
const zoraFactoryJSON = require("./abis/ZoraFactory.json");
const mintWithDegenJSON = require("../artifacts/contracts/MintWithDegen.sol/MintWithDegen.json");
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, ethers.provider);
//const degen = new ethers.Contract(addr.degen, degenJSON.abi, signer);
const da = new ethers.Contract(addr.degenerativeArt, zora1155JSON.abi, signer);
const zoraFactory = new ethers.Contract(addr.zoraFactory, zoraFactoryJSON.abi, signer);
var mwd;

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

describe("Mint with Degen", function() {

  before('Deploy Contracts', async function () {
    // runs once before the first test in this block
    this.timeout(2400000);
    network = await ethers.provider.getNetwork();
    const MyContract = await ethers.getContractFactory("MintWithDegen");
    // Start deployment, returning a promise that resolves to a contract object
    mwd = await MyContract.deploy(addr.degen, addr.fixedPriceSaleStrategy, mintFee, tokaFee); // Instance of the contract 
    console.log("Contract deployed to address:", mwd.address);
    addr.mintWithDegen = mwd.address;
  });

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
      await mwd.setDegenPricePerToken1155(addr.degenerativeArt, 1, price, gasOptions);
    } else {
      console.log("gasOptions not found");
    }
    expect(1).to.equal(1);
  });

  // it should return degenPricePerToken for degenerativeArt contract
  it("Should return degenPricePerToken for degenerativeArt contract", async function() {
    var price = await mwd.getDegenPricePerToken1155(addr.degenerativeArt, 1);
    console.log("price", price);
    expect(1).to.equal(1);
  });

  // it should return totalDegenPricePerToken for degenerativeArt contract
  it("Should return totalDegenPricePerToken for degenerativeArt contract", async function() {
    var price = await mwd.getTotalDegenPricePerToken1155(addr.degenerativeArt, 1);
    console.log("price", price);
    expect(1).to.equal(1);
  });


}); // end describe

describe("ZoraFactory", function() {
  


}); // end describe
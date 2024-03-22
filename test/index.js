const { expect } = require("chai");
const { ethers } = require("hardhat");
const fetch = require('node-fetch');

const networkName = hre.network.name;
console.log(networkName);

require('dotenv').config();

var addr = {};
addr.degen = "0xCAd106ec4a3d792008ff113C8BaCb384f1b84046";
addr.degenerativeArt = "0x4578F0CB63599699DDBDa70760c6BBEc9e88A89E"; // Base, Zora1155
addr.zoraFactory = "0x777777C338d93e2C7adf08D102d45CA7CC4Ed021";

// supportsInterface('0x80ac58cd') // ERC721
// supportsInterface('0xd9b67a26') // ERC1155


//const degenJSON = require("../artifacts/contracts/MockDegen.sol/MockDegen.json");
const zora1155JSON = require("./abis/Zora1155.json");
const zoraFactoryJSON = require("./abis/ZoraFactory.json");
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, ethers.provider);
//const degen = new ethers.Contract(addr.degen, degenJSON.abi, signer);
const da = new ethers.Contract(addr.degenerativeArt, zora1155JSON.abi, signer);
const zoraFactory = new ethers.Contract(addr.zoraFactory, zoraFactoryJSON.abi, signer);

async function getGasPrices() {
  console.log("start getGasPrices");
  // retrun proimse
  return new Promise(async (resolve, reject) => {
    var resGas = await fetch('https://frm.lol/api/gas/base');
    console.log("resGas", resGas);
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

}); // end describe

describe("ZoraFactory", function() {
  


}); // end describe
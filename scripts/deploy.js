const chain = hre.network.name;

var addr = {
    "degen": process.env.DEGEN_CONTRACT,
    "fixedPriceSaleStrategy": process.env.FIXED_PRICE_SALE_STRATEGY,
    "toka": process.env.TOKA_ADDRESS
  };
const tokaFee = ethers.utils.parseEther("69");
const mintFee = ethers.utils.parseEther("420");

var swapper, mwd, toka721;

async function main() {
    const MySwapper = await ethers.getContractFactory("Swapper");
    // Start deployment, returning a promise that resolves to a contract object
    swapper = await MySwapper.deploy(); // Instance of the contract 
    console.log("Contract deployed to address:", swapper.address);
    console.log(`npx hardhat verify --network ${chain} ${swapper.address}`);
    addr.swapper = swapper.address;

    const MyContract = await ethers.getContractFactory("TokaMint1155");
    // Start deployment, returning a promise that resolves to a contract object
    mwd = await MyContract.deploy(addr.degen, addr.fixedPriceSaleStrategy, addr.swapper, mintFee, tokaFee, addr.toka); // Instance of the contract 
    console.log("Contract deployed to address:", mwd.address);
    console.log(`npx hardhat verify --network ${chain} ${mwd.address} ${addr.degen} ${addr.fixedPriceSaleStrategy} ${addr.swapper} ${mintFee} ${tokaFee} ${addr.toka}`);
    addr.mintWithDegen = mwd.address;

    const MyContract721 = await ethers.getContractFactory("TokaMint721");
    // Start deployment, returning a promise that resolves to a contract object
    toka721 = await MyContract721.deploy(addr.degen, addr.swapper, mintFee, tokaFee, addr.toka); // Instance of the contract 
    console.log("Contract deployed to address:", toka721.address);
    console.log(`npx hardhat verify --network ${chain} ${toka721.address} ${addr.degen} ${addr.swapper} ${mintFee} ${tokaFee} ${addr.toka}`);
    addr.toka721 = toka721.address;

 }
 
 main()
   .then(() => process.exit(0))
   .catch(error => {
     console.error(error);
     process.exit(1);
   });
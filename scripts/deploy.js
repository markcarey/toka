const chain = hre.network.name;

var addr = {
    "degen": process.env.DEGEN_CONTRACT,
    "fixedPriceSaleStrategy": process.env.FIXED_PRICE_SALE_STRATEGY,
};
const tokaFee = ethers.utils.parseEther("69");
const mintFee = ethers.utils.parseEther("420");

async function main() {
    const MyContract = await ethers.getContractFactory("MintWithDegen");
 
    // Start deployment, returning a promise that resolves to a contract object
    const contract = await MyContract.deploy(addr.degen, addr.fixedPriceSaleStrategy, mintFee, tokaFee); // Instance of the contract 
    console.log("Contract deployed to address:", contract.address);
    console.log(`npx hardhat verify --network ${chain} ${contract.address} ${addr.degen} ${addr.fixedPriceSaleStrategy} ${mintFee} ${tokaFee}`);

 }
 
 main()
   .then(() => process.exit(0))
   .catch(error => {
     console.error(error);
     process.exit(1);
   });
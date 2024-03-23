// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.17;

//import "./interfaces/IZoraCreatorFixedPriceSaleStrategy.sol";
//import "./interfaces/IZoraCreatorMerkleMinterStrategy.sol";
//import "./interfaces/IZoraCreator1155.sol";
import "./interfaces/IERC721Drop.sol";
import "./interfaces/ISwapper.sol";
//import {IZoraCreator1155Factory} from "@zoralabs/zora-1155-contracts/src/interfaces/IZoraCreator1155Factory.sol";
//import {IZoraCreator1155} from "@zoralabs/zora-1155-contracts/src/interfaces/IZoraCreator1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

// console
import "hardhat/console.sol";

interface IWETH {
    function withdraw(uint wad) external;
    function balanceOf(address owner) external view returns (uint);
}

contract TokaMint721 is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    // degen token address on Base:
    address _toka;
    IERC20 public _degen;
    // zora factory address TODO: do we need the factory?
    //IZoraCreator1155Factory public _zoraFactory = IZoraCreator1155Factory(0x777777C338d93e2C7adf08D102d45CA7CC4Ed021);
    //IZoraCreatorFixedPriceSaleStrategy public _fixedPriceSaleStrategy;
    //IZoraCreatorMerkleMinterStrategy public _merkleMinterStrategy;
    ISwapper public _swapper;
    uint256 public _mintFee; // mint fee in degen
    uint256 public _tokaFee; // toka's take in degen
    IWETH _weth = IWETH(0x4200000000000000000000000000000000000006);

    bytes32 public immutable MINTER_ROLE = keccak256("MINTER");
    bytes32 public immutable SALES_MANAGER_ROLE = keccak256("SALES_MANAGER");

    // degen price per token per contract address: contract => tokenId => price
    mapping(address => mapping(uint256 => uint256)) public _degenPricePerToken;

    constructor(IERC20 degen, ISwapper swapper, uint256 mintFee, uint256 tokaFee, address toka) {
        _degen = degen;
        //_fixedPriceSaleStrategy = fixedPriceSaleStrategy;
        //_merkleMinterStrategy = merkleMinterStrategy;
        _swapper = swapper;
        _mintFee = mintFee;
        _tokaFee = tokaFee;
        _toka = toka;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _degen.approve(address(_swapper), type(uint256).max);
    }

    function getSalesStrategy(IERC721Drop nft, uint256 tokenId) public view returns (IERC721Drop.SalesConfiguration memory) {
        return nft.salesConfig();
    }

    function _swapMint(address to, IERC721Drop nft, uint256 tokenId, uint256 amount) public {
        // assume mintFee is enough to cover the swap
        uint256 amountIn = _mintFee * amount;
        // transferFrom amountIn in degen
        _degen.transferFrom(msg.sender, address(this), amountIn);
        // eth balance before
        uint256 balanceBefore = address(this).balance;
        _swapper.swap(amountIn);
        // with draw weth balance
        _weth.withdraw(_weth.balanceOf(address(this)));
        // eth balance after
        uint256 balanceAfter = address(this).balance;
        // amount eth increased
        console.log("eth increased: %d", balanceAfter - balanceBefore);
        // mint the token
        console.log("before mintWithRewards");
        // mint the token and send 0.000777 value in the function call
        (, uint256 zoraFee) = nft.zoraFeeForAmount(amount);
        console.log("zoraFee: %d", zoraFee);
        console.log("tokenId: %d", tokenId);
        console.log("amount: %d", amount);
        console.log("_toka: %s", _toka);
        nft.mintWithRewards{value: zoraFee}(to, amount, "", _toka);
        console.log("after mintWithRewards");
    }

    //mint function
    function mintWithDegen(address to, IERC721Drop nft, uint256 tokenId, uint256 amount) public payable {
        if (_degenPricePerToken[address(nft)][tokenId] == 0) {
            // if the price is not set, try swapMint
            _swapMint(to, nft, tokenId, amount);
        } else {
            //get the zora nft contract
            //IZoraCreator1155 nft = IZoraCreator1155(nftContract);
            //get the sale strategy
            IERC721Drop.SalesConfiguration memory salesConfig = nft.salesConfig();
            //check if the sale is a fixed price sale
            console.log("sale start: %d", salesConfig.publicSaleStart);
            if (salesConfig.publicSaleStart > 0) {
                //check if the sale is still ongoing
                require(block.timestamp >= salesConfig.publicSaleStart && block.timestamp <= salesConfig.publicSaleEnd, "Sale not ongoing");
            }
            // check if amount is less than max tokens per address
            require(salesConfig.maxSalePurchasePerAddress == 0 || amount <= salesConfig.maxSalePurchasePerAddress, "Max tokens per address reached");
            console.log("after maxTokens");
            //check if the user has enough degen
            //require(_degen.balanceOf(msg.sender) >= salesConfig.pricePerToken * amount, "Not enough degen");

            //transfer the degen to the contract
            console.log("before transferFrom");
            _degen.transferFrom(msg.sender, address(this), ( _mintFee + _degenPricePerToken[address(nft)][tokenId] ) * amount);
            console.log("after transferFrom");
            //mint the token
            nft.adminMint(to, amount);
            console.log("after adminMint");
            // transfer degen and fees
            (address recipient, ) = nft.royaltyInfo(1, 1);
            _degen.transfer(recipient, _degenPricePerToken[address(nft)][tokenId] * amount);
            console.log("after transfer recipient");
        }
    }

    // MANAGER can call this after offchain enforcement of the minting rules (follow, recast, etc.)
    // No fees collected
    function adminMint(address to, IERC721Drop nft, uint256 tokenId, uint256 amount) public {
        require(hasRole(MANAGER_ROLE, msg.sender), "Not manager");
        nft.adminMint(to, amount);
    }

    function setDegenPricePerToken(IERC721Drop nft, uint256 tokenId, uint256 price) public {
        // require admin permissions on NFT contract
        require(    nft.hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
                    nft.hasRole(SALES_MANAGER_ROLE, msg.sender),
        "Not admin");
        _degenPricePerToken[address(nft)][tokenId] = price;
    }

    function _setDegenPricePerToken(IERC721Drop nft, uint256 tokenId, uint256 price) public  onlyRole(MANAGER_ROLE){
        // this will succeed only if the contract has the SALES_MANAGER_ROLE role on the NFT contract
        this.setDegenPricePerToken(nft, tokenId, price);
    }

    function getDegenPricePerToken(IERC721Drop nft, uint256 tokenId) public view returns (uint256) {
        return _degenPricePerToken[address(nft)][tokenId];
    }

    function getTotalDegenPricePerToken(IERC721Drop nft, uint256 tokenId) public view returns (uint256) {
        return _degenPricePerToken[address(nft)][tokenId] + _mintFee;
    }

    // set mint fee function onlyRole(MANAGER_ROLE)
    function setMintFee(uint256 mintFee) public {
        require(hasRole(MANAGER_ROLE, msg.sender), "Not manager");
        _mintFee = mintFee;
    }

    // set toka fee function
    function setTokaFee(uint256 tokaFee) public {
        require(hasRole(MANAGER_ROLE, msg.sender), "Not manager");
        _tokaFee = tokaFee;
    }

    // withdraw function for toka admin
    function withdrawDegen() public {
        require(hasRole(MANAGER_ROLE, msg.sender), "Not manager");
        _degen.transfer(msg.sender, _degen.balanceOf(address(this)));
    }

    // withdraw eth function for toka admin
    function withdrawEth() public {
        require(hasRole(MANAGER_ROLE, msg.sender), "Not manager");
        payable(msg.sender).transfer(address(this).balance);
    }

    // default payable function
    receive() external payable {}

}


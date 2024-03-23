// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.17;

import "./interfaces/IZoraCreatorFixedPriceSaleStrategy.sol";
//import "./interfaces/IZoraCreatorMerkleMinterStrategy.sol";
import "./interfaces/IZoraCreator1155.sol";
import "./interfaces/IERC721Drop.sol";
//import {IZoraCreator1155Factory} from "@zoralabs/zora-1155-contracts/src/interfaces/IZoraCreator1155Factory.sol";
//import {IZoraCreator1155} from "@zoralabs/zora-1155-contracts/src/interfaces/IZoraCreator1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MintWithDegen is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    // degen token address on Base:
    IERC20 public _degen;
    // zora factory address TODO: do we need the factory?
    //IZoraCreator1155Factory public _zoraFactory = IZoraCreator1155Factory(0x777777C338d93e2C7adf08D102d45CA7CC4Ed021);
    IZoraCreatorFixedPriceSaleStrategy public _fixedPriceSaleStrategy;
    //IZoraCreatorMerkleMinterStrategy public _merkleMinterStrategy;
    uint256 public _mintFee; // mint fee in degen
    uint256 public _tokaFee; // toka's take in degen

    // degen price per token per contract address: contract => tokenId => price
    mapping(address => mapping(uint256 => uint256)) public _degenPricePerToken;

    constructor(IERC20 degen, IZoraCreatorFixedPriceSaleStrategy fixedPriceSaleStrategy, uint256 mintFee, uint256 tokaFee) {
        _degen = degen;
        _fixedPriceSaleStrategy = fixedPriceSaleStrategy;
        //_merkleMinterStrategy = merkleMinterStrategy;
        _mintFee = mintFee;
        _tokaFee = tokaFee;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
    }

    //mint function
    function mintWithDegen1155(address to, IZoraCreator1155 nft, uint256 tokenId, uint256 amount) public {
        //get the zora nft contract
        //IZoraCreator1155 nft = IZoraCreator1155(nftContract);
        //get the sale strategy
        IZoraCreatorFixedPriceSaleStrategy.SalesConfig memory salesConfig = _fixedPriceSaleStrategy.sale(address(nft), tokenId);
        //check if the sale is a fixed price sale
        if (salesConfig.saleStart > 0) {
            //check if the sale is still ongoing
            require(block.timestamp >= salesConfig.saleStart && block.timestamp <= salesConfig.saleEnd, "Sale not ongoing");
        }
        // check if amount is less than max tokens per address
        require(salesConfig.maxTokensPerAddress == 0 || nft.balanceOf(msg.sender, tokenId) + amount <= salesConfig.maxTokensPerAddress, "Max tokens per address reached");

        //check if the user has enough degen
        //require(_degen.balanceOf(msg.sender) >= salesConfig.pricePerToken * amount, "Not enough degen");

        //transfer the degen to the contract
        _degen.transferFrom(msg.sender, address(this), ( _mintFee + _degenPricePerToken[address(nft)][tokenId] ) * amount);
        //mint the token
        nft.adminMint(to, tokenId, amount, "");
        // transfer degen and fees
        _degen.transfer(salesConfig.fundsRecipient, _degenPricePerToken[address(nft)][tokenId] * amount);
    }

    function setDegenPricePerToken1155(IZoraCreator1155 nft, uint256 tokenId, uint256 price) public {
        // require admin permissions on NFT contract
        require(    nft.isAdminOrRole(msg.sender, tokenId, nft.PERMISSION_BIT_MINTER()) ||
                    nft.isAdminOrRole(msg.sender, 0, nft.PERMISSION_BIT_MINTER()),
        "Not admin");
        _degenPricePerToken[address(nft)][tokenId] = price;
    }

    function _setDegenPricePerToken1155(IZoraCreator1155 nft, uint256 tokenId, uint256 price) public  onlyRole(MANAGER_ROLE){
        // this will succeed only if the contract has the MINTER role on the NFT contract
        this.setDegenPricePerToken1155(nft, tokenId, price);
    }

    function getDegenPricePerToken1155(IZoraCreator1155 nft, uint256 tokenId) public view returns (uint256) {
        return _degenPricePerToken[address(nft)][tokenId];
    }

    function getTotalDegenPricePerToken1155(IZoraCreator1155 nft, uint256 tokenId) public view returns (uint256) {
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


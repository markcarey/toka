// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.17;

import "./interfaces/IZoraCreatorFixedPriceSaleStrategy.sol";
import "./interfaces/IZoraCreatorMerkleMinterStrategy.sol";
import {IZoraCreator1155Factory} from "@zoralabs/zora-1155-contracts/src/interfaces/IZoraCreator1155Factory.sol";
import {IZoraCreator1155} from "@zoralabs/zora-1155-contracts/src/interfaces/IZoraCreator1155.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MintWithDegen {
    // degen token address on Base:
    IERC20 public _degen;
    // zora factory address:
    IZoraCreator1155Factory public _zoraFactory = IZoraCreator1155Factory(0x777777C338d93e2C7adf08D102d45CA7CC4Ed021);

    constructor(IERC20 degen) {
        _degen = degen;
    }

    //mint function
    function mint(uint256 tokenId, uint256 amount) public {
        //get the zora contract address
        address zoraContract = _zoraFactory.addresses(tokenId);
        //get the zora contract
        IZoraCreator1155 zora = IZoraCreator1155(zoraContract);
        //get the sale strategy
        (address saleStrategy, uint256 saleStrategyId) = zora.saleStrategy(tokenId);
        //get the sale strategy contract
        IZoraCreatorFixedPriceSaleStrategy fixedPriceSaleStrategy = IZoraCreatorFixedPriceSaleStrategy(saleStrategy);
        //get the sale strategy contract
        IZoraCreatorMerkleMinterStrategy merkleMinterStrategy = IZoraCreatorMerkleMinterStrategy(saleStrategy);
        //get the sale strategy contract
        IZoraCreatorMerkleMinterStrategy.MerkleSaleSettings memory merkleSaleSettings = merkleMinterStrategy.sale(zoraContract, tokenId);
        //get the sale strategy contract
        IZoraCreatorFixedPriceSaleStrategy.SalesConfig memory salesConfig = fixedPriceSaleStrategy.sale(zoraContract, tokenId);
        //check if the sale is a fixed price sale
        if (salesConfig.saleStart > 0) {
            //check if the sale is still ongoing
            require(block.timestamp >= salesConfig.saleStart && block.timestamp <= salesConfig.saleEnd, "Sale not ongoing");
            //check if the user has enough degen
            require(_degen.balanceOf(msg.sender) >= salesConfig.pricePerToken * amount, "Not enough degen");
            //transfer the degen to the contract
            _degen.transferFrom(msg.sender, address(this), salesConfig.pricePerToken * amount);
            //mint the token
            zora.mint(msg.sender, tokenId, amount, "");
        } else {
            //check if the sale is still ongoing
            require(block.timestamp >= merkleSaleSettings.presaleStart && block.timestamp <= merkleSaleSettings.presaleEnd, "Sale not ongoing");
            //check if the user has enough degen
            require(_degen.balanceOf(msg.sender) >= salesConfig.pricePerToken * amount, "Not enough degen");
            //transfer the degen to the contract
            _degen.transferFrom(msg.sender, address(this), salesConfig.pricePerToken * amount);
            //mint the token
            zora.mint(msg.sender, tokenId, amount, "");
        }
}


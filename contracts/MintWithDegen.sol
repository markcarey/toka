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

    /// @notice Compiles and returns the commands needed to mint a token using this sales strategy
    /// @param mintMsgSender The address that called the mint on the 1155 contract
    /// @param tokenId The token ID to mint
    /// @param quantity The quantity of tokens to mint
    /// @param ethValueSent The amount of ETH sent with the transaction
    /// @param minterArguments The arguments passed to the minter, which should be the address to mint to
    function requestMint(
        address mintMsgSender,
        uint256 tokenId,
        uint256 quantity,
        uint256 ethValueSent,
        bytes calldata minterArguments
    ) external returns (ICreatorCommands.CommandSet memory commands) {
        // Ensure the minter is allowed to mint either this token or all tokens contract-wide
        if (!isMinter(msg.sender, tokenId, mintMsgSender)) {
            revert ONLY_MINTER();
        }

        address mintTo;
        string memory comment = "";

        if (minterArguments.length == 32) {
            mintTo = abi.decode(minterArguments, (address));
        } else {
            (mintTo, comment) = abi.decode(minterArguments, (address, string));
        }

        SalesConfig storage config = salesConfigs[msg.sender][tokenId];

        // If sales config does not exist this first check will always fail.

        // Check sale end
        if (block.timestamp > config.saleEnd) {
            revert SaleEnded();
        }

        // Check sale start
        if (block.timestamp < config.saleStart) {
            revert SaleHasNotStarted();
        }

        // Check value sent
        if (config.pricePerToken * quantity != ethValueSent) {
            revert WrongValueSent();
        }

        bool shouldTransferFunds = config.fundsRecipient != address(0);
        commands.setSize(shouldTransferFunds ? 2 : 1);

        // Mint command
        commands.mint(mintTo, tokenId, quantity);

        if (bytes(comment).length > 0) {
            emit MintComment(mintTo, msg.sender, tokenId, quantity, comment);
        }

        // Should transfer funds if funds recipient is set to a non-default address
        if (shouldTransferFunds) {
            commands.transfer(config.fundsRecipient, ethValueSent);
        }
    }
    
}


// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.17;

import "./interfaces/IERC721Drop.sol";
import "./interfaces/ISwapper.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IWETH {
    function withdraw(uint wad) external;
    function balanceOf(address owner) external view returns (uint);
}

contract TokaMint721 is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    address _toka;
    IERC20 public _degen;
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
        _degen.transferFrom(msg.sender, address(this), amountIn);
        _swapper.swap(amountIn);
        _weth.withdraw(_weth.balanceOf(address(this)));
        (, uint256 zoraFee) = nft.zoraFeeForAmount(amount);
        nft.mintWithRewards{value: zoraFee}(to, amount, "", _toka);
    }

    //mint function
    function mintWithDegen(address to, IERC721Drop nft, uint256 tokenId, uint256 amount) public payable {
        if (_degenPricePerToken[address(nft)][tokenId] == 0) {
            // if the price is not set, try swapMint
            _swapMint(to, nft, tokenId, amount);
        } else {
            IERC721Drop.SalesConfiguration memory salesConfig = nft.salesConfig();
            if (salesConfig.publicSaleStart > 0) {
                //check if the sale is still ongoing
                require(block.timestamp >= salesConfig.publicSaleStart && block.timestamp <= salesConfig.publicSaleEnd, "Sale not ongoing");
            }
            // check if amount is less than max tokens per address
            require(salesConfig.maxSalePurchasePerAddress == 0 || amount <= salesConfig.maxSalePurchasePerAddress, "Max tokens per address reached");

            //transfer the degen to the contract
            _degen.transferFrom(msg.sender, address(this), ( _mintFee + _degenPricePerToken[address(nft)][tokenId] ) * amount);

            //mint the token
            nft.adminMint(to, amount);

            // transfer degen and fees
            (address recipient, ) = nft.royaltyInfo(1, 1);
            _degen.transfer(recipient, (_degenPricePerToken[address(nft)][tokenId] + _mintFee - _tokaFee) * amount);
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

    function setMintFee(uint256 mintFee) public {
        require(hasRole(MANAGER_ROLE, msg.sender), "Not manager");
        _mintFee = mintFee;
    }

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


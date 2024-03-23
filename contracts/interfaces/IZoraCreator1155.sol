// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./IZoraCreatorFixedPriceSaleStrategy.sol";

interface IZoraCreator1155 {

    function mintWithRewards(IZoraCreatorFixedPriceSaleStrategy minter, uint256 tokenId, uint256 quantity, bytes calldata minterArguments, address mintReferral) external payable;
    
    function adminMint(address recipient, uint256 tokenId, uint256 quantity, bytes memory data) external;

    function adminMintBatch(address recipient, uint256[] memory tokenIds, uint256[] memory quantities, bytes memory data) external;

    function burnBatch(address user, uint256[] calldata tokenIds, uint256[] calldata amounts) external;

    function balanceOf(address account, uint256 id) external view returns (uint256);

    function mintFee() external view returns (uint256);

    function PERMISSION_BIT_MINTER() external view returns (uint256);
    function isAdminOrRole(address user, uint256 tokenId, uint256 role) external view returns (bool);

    function supportsInterface(bytes4 interfaceId) external view returns (bool);

}
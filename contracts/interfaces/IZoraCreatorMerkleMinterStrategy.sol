// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IZoraCreatorMerkleMinterStrategy {
    /// @notice General merkle sale settings
    struct MerkleSaleSettings {
        /// @notice Unix timestamp for the sale start
        uint64 presaleStart;
        /// @notice Unix timestamp for the sale end
        uint64 presaleEnd;
        /// @notice Funds recipient (0 if no different funds recipient than the contract global)
        address fundsRecipient;
        /// @notice Merkle root for
        bytes32 merkleRoot;
    }
    function sale(address tokenContract, uint256 tokenId) external view returns (MerkleSaleSettings memory);
}
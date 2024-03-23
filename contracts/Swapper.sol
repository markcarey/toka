// SPDX-License-Identifier: MIT
pragma solidity =0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
//import "@openzeppelin/contracts/math/SafeMath.sol";
//import "./interfaces/IUniswapV3Factory.sol";
import "./interfaces/IUniswapV3Pool.sol";
import "./interfaces/IUniswapV3SwapCallback.sol";

contract Swapper is IUniswapV3SwapCallback {
    //using SafeMath for uint256;
    IERC20 private constant DEGEN = IERC20(0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed);
    IERC20 private constant WETH = IERC20(0x4200000000000000000000000000000000000006);
    IUniswapV3Pool private constant WETHtoDEGENPool = IUniswapV3Pool(0xc9034c3E7F58003E6ae0C8438e7c8f4598d5ACAA);

    event Swapped(uint256 amountIn, uint256 amountOut);

    function swap(uint256 amountIn) external {
        DEGEN.transferFrom(msg.sender, address(this), amountIn);
        uint256 WETHBefore = WETH.balanceOf(msg.sender);
        bytes memory data = abi.encode(address(DEGEN), amountIn, address(WETH));
        WETHtoDEGENPool.swap(msg.sender, false, int256(amountIn), 1461446703485210103287273052203988822378723970341, data);
        uint256 amountOut = WETH.balanceOf(msg.sender) - WETHBefore;
        emit Swapped(amountIn, amountOut);
    }
    
    // @notice Function is called by the Uniswap V3 pair's `swap` function
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external override {
        require(msg.sender == address(WETHtoDEGENPool), "only uniswap v3 pair can call this function");
        (address _from, , ) = abi.decode(_data, (address, uint, address));
        uint256 amountToRepay = uint256( amount0Delta > 0 ? amount0Delta: amount1Delta );
        IERC20(_from).transfer(msg.sender, amountToRepay);
    }
}
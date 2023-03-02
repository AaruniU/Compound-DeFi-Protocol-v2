// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

abstract contract ERC20
{
    function approve(address, uint) virtual external returns (bool);
    function balanceOf(address) virtual public view  returns (uint256);
}

abstract contract cERC20
{
    function mint(uint) virtual external returns (uint);
    function borrow(uint) virtual external returns (uint);
    function borrowBalanceCurrent(address account) virtual external returns (uint);
}

abstract contract cETH
{
    function mint() virtual external payable;
}

abstract contract Comptroller
{
    function enterMarkets(address[] calldata) virtual external returns (uint[] memory);
    function markets(address) virtual external returns (bool, uint256);
    function getAccountLiquidity(address) virtual public view returns (uint, uint, uint);
}

abstract contract PriceFeed
{
    function getUnderlyingPrice(address) virtual external view returns (uint);
}

contract BorrowingAssetsFromCompound
{
    // Borrow ERC20 token by using ETH as collateral
    function BorrowERC20FromCompound(address cETHv2Address, address comptrollerAddress, address priceFeedAddress, address cERC20Address) public payable
    {
        // Supply ETH as collateral to Compound
        cETH _cETH = cETH(cETHv2Address);
        _cETH.mint{value: msg.value}();

        // "Enter the Market" to announce we will use ETH as collateral
        Comptroller comptroller = Comptroller(comptrollerAddress);
        address[] memory cTokens = new address[](1);
        cTokens[0] = cETHv2Address;
        comptroller.enterMarkets(cTokens);

        // Get the collateral factor
        // "markets" is a mapping from address=>Market. Market is a struct with 2 state variables: isListed and collateralFactorMantissa
        (, uint collateralFactor) = comptroller.markets(cETHv2Address);
        console.log("Collateral factor is: ", collateralFactor);

        // Our goal is to borrow DAI so lets find out its price
        PriceFeed pricefeed = PriceFeed(priceFeedAddress);
        uint256 underlyingPrice = pricefeed.getUnderlyingPrice(cERC20Address);
        console.log("Underlying price for cERC20 token is (in USD): ", underlyingPrice);

        // We have not borrowed anything yet but its a good to idea to check the liquidity available to us (in USD)
        (, uint256 liquidity, ) = comptroller.getAccountLiquidity(address(this));
        console.log("BorrowingAssetsFromCompound's liquidity is (in USD): ", liquidity);

        // Find out the max DAI we can borrow
        uint256 maxBorrowUnderlying = liquidity / underlyingPrice;
        console.log("Maximum underlying ERC20 token that can be borrowed (liquidity / underlyingPrice): ", maxBorrowUnderlying);

        // Lets borrow 100 DAI
        uint256 borrowAmount = 100;
        cERC20 _cERC20 = cERC20(cERC20Address);
        _cERC20.borrow(borrowAmount * 10**18);

        // Check DAI balance after borrow()
        address daiTokenAddress = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
        ERC20 dai = ERC20(daiTokenAddress);
        console.log("DAI balance is: ", dai.balanceOf(address(this)));
        
        // Check our DAI borrow balance
        uint borrowBalance = _cERC20.borrowBalanceCurrent(address(this));
        console.log("DAI Borrow Balance is ", borrowBalance);
    }

    // Borrow ETH token by supplying ERC20 as collateral
    function BorrowETHFromCompound(address erc20TokenAddress, address cERC20TokenAddress, address comptrollerAddress, address priceFeedAddress, address cETHAddress) public
    {
        // Supply 5000 ERC20 tokens as collateral (DAI in our case)
        // We need to allow cERC20 contract to be able to withdraw our ERC20 tokens
        ERC20 dai = ERC20(erc20TokenAddress);
        dai.approve(cERC20TokenAddress, 5000000000000000000000);
        
        console.log("Contract's DAI balance before mint(): ", dai.balanceOf(address(this)));
        
        // Call cERC20 token's mint() function
        cERC20 cdai = cERC20(cERC20TokenAddress);
        cdai.mint(5000000000000000000000);

        console.log("Contract's DAI balance after mint(): ", dai.balanceOf(address(this)));

        // "Enter the Market" to announce we will use DAI as collateral
        Comptroller comptroller = Comptroller(comptrollerAddress);
        address[] memory cTokens = new address[](1);
        cTokens[0] = cERC20TokenAddress;
        comptroller.enterMarkets(cTokens);

        // Get the collateral factor
        (, uint collateralFactor) = comptroller.markets(cERC20TokenAddress);
        console.log("Collateral factor is: ", collateralFactor);

        // Our goal is to borrow ETH so lets find out its price
        PriceFeed pricefeed = PriceFeed(priceFeedAddress);
        uint256 underlyingPrice = pricefeed.getUnderlyingPrice(cETHAddress);
        console.log("Underlying price for cERC20 token is (in USD): ", underlyingPrice);

        // We have not borrowed anything yet but its a good to idea to check the liquidity available to us (in USD)
        (, uint256 liquidity, ) = comptroller.getAccountLiquidity(address(this));
        console.log("BorrowingAssetsFromCompound's liquidity is (in USD): ", liquidity);

        // Find out the max ETH we can borrow
        uint256 maxBorrowUnderlying = liquidity / underlyingPrice;
        console.log("Maximum underlying ERC20 token that can be borrowed (liquidity / underlyingPrice): ", maxBorrowUnderlying);

        // Lets borrow 1 ETH
        uint256 borrowAmount = 1;
        cERC20 ceth = cERC20(cETHAddress);
        ceth.borrow(borrowAmount * 10**18);

        // Check our ETH borrow balance
        uint borrowBalance = ceth.borrowBalanceCurrent(address(this));
        console.log("ETH Borrow Balance is ", borrowBalance);
    }

    // cETH.borrow() deposits money through receive()/fallback()
    receive() external payable {}
}

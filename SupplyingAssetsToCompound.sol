// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract DAI
{
    function approve(address, uint) virtual external returns (bool);
}

abstract contract cETH
{
    function mint() virtual external payable;

}

abstract contract cDAI
{
    function mint(uint) virtual external returns (uint);
    function redeem(uint) virtual external returns (uint);
    function redeemUnderlying(uint) virtual external returns (uint);
}

contract SupplyingAssetsToCompound
{
    function SupplyETHtoCompound() public payable
    {
        address cETHv2Address = 0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5;
        cETH _cETH = cETH(cETHv2Address);

        // Call mint() and forward all ETH
        _cETH.mint{value: msg.value}();
    }

    function SupplyERC20toCompound() public
    {
        address daiTokenAddress = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
        address cdaiTokenAddress = 0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643;
        
        // We need to allow cDAI contract to be able to withdraw our DAI tokens
        DAI dai = DAI(daiTokenAddress);
        dai.approve(cdaiTokenAddress, 1000000000000000000);
        
        // Call cDAI token's mint() function
        cDAI _cDAI = cDAI(cdaiTokenAddress);
        _cDAI.mint(1000000000000000000);
    }

    function RedeemERC20FromCompound(uint _amount, bool underlying) public
    {
        address cdaiTokenAddress = 0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643;
        
        // Call cDAI token's mint() function
        cDAI _cDAI = cDAI(cdaiTokenAddress);
        
        if(underlying)
        {
            // Takes _amount in DAI
            _cDAI.redeemUnderlying(_amount);
        }        
        else
        {
            // Takes _amount in cDAI
            _cDAI.redeem(_amount);
        }
    } 
}

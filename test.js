const { expect, config } = require("chai");
const { Wallet, getDefaultProvider } = require("ethers");
const { hexStripZeros } = require("ethers/lib/utils");
const { ethers, network } = require("hardhat");
const hardhatConfig = require("../hardhat.config");

describe("Test run", () => {
    
    beforeEach(async function () {
        // Reset fork before each test
        await network.provider.send("hardhat_reset", [{
            forking: {
              jsonRpcUrl: hardhatConfig.networks.hardhat.forking.url,
              blockNumber: hardhatConfig.networks.hardhat.forking.blockNumber
            }
        }])
    })
    
    it("Supply ETH to Compound", async() => {

        const cETHv2Address = "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5"
        const cETHv2ABI = ["function balanceOf(address owner) external view returns (uint256 balance)"
                            , "function exchangeRateCurrent() public returns (uint)"
                            , "function balanceOfUnderlying(address owner) external returns (uint)"];

        // Lets use the 1/20 free accounts provided by hardhat
        const [signer] = await ethers.getSigners();
        var signerBalance = await ethers.provider.getBalance(signer.address)
        console.log("Signer address is: ", signer.address)
        console.log("Signer ETH balance is: ", signerBalance)

        const cETHv2Contract = new ethers.Contract(cETHv2Address, cETHv2ABI, signer)

        // Lets deploy our SupplyingAssetsToCompound contract
        const supplyingAssetsToCompoundContract = await ethers.getContractFactory("SupplyingAssetsToCompound")
        const supplyingAssetsToCompound = await supplyingAssetsToCompoundContract.connect(signer).deploy()
        await supplyingAssetsToCompound.deployed()
        console.log("SupplyingAssetsToCompound was deployed at: ", supplyingAssetsToCompound.address)
        
        // Send some ETH to Compound
        await supplyingAssetsToCompound.SupplyETHtoCompound({gasLimit: 1700000, value: ethers.utils.parseEther("5")})

        // Verify our cETH balance after depositing ETH
        console.log("cETH tokens deposited to SupplyingAssetsToCompound: ", await cETHv2Contract.balanceOf(supplyingAssetsToCompound.address))

        // Verify our ETH balance after depositing ETH
        var underlyingETH = await cETHv2Contract.callStatic.balanceOfUnderlying(supplyingAssetsToCompound.address)
        console.log("SupplyingAssetsToCompound's ETH balance is: ", underlyingETH)

        // ETH supplied in wei / cETH tokens received = Exchange Rate / 1000000000000000000
        var exchangeRate = await cETHv2Contract.callStatic.exchangeRateCurrent()
        console.log("Exchange rate is: ", exchangeRate)
    });


    it("Supply ERC20 token to Compound", async() => {

        // We will use the DAI ERC20 token for our example
        // First, we need to steal 1 DAI from some poor token holer
        
        const [signer] = await ethers.getSigners();
        
        // Impersonate account that has some DAI
        const daiHodler = "0x85D5b6EECE5451e43B63a68f9aCD1b9A5a01AF36"
        await network.provider.send("hardhat_impersonateAccount", [daiHodler])
        const impersonatedSigner = await ethers.getSigner(daiHodler)

        // Get the DAI token instance
        const daiTokenAddress = "0x6b175474e89094c44da98b954eedeac495271d0f"
        const erc20ABI = [
            "function balanceOf(address account) public view  returns (uint256)",
            "function transfer(address to, uint256 amount) public returns (bool)"
        ]
        const daiToken = await ethers.getContractAt(erc20ABI, daiTokenAddress)

        // Find the token holder's DAI balance
        console.log("\ndaiHodler's DAI balance is: ", await daiToken.connect(impersonatedSigner).balanceOf(daiTokenAddress))
        
        // Lets check the balance before DAI transfer
        console.log("Signer's DAI balance before transfer is: ", await daiToken.connect(signer).balanceOf(signer.address))
        
        // Connect to the impersonatedSigner and send 1 DAI to your signer
        await daiToken.connect(impersonatedSigner).transfer(signer.address, 1000000000000000000n, {gasLimit: 100000})

        // Lets check the balance after DAI transfer
        console.log("Signer's DAI balance after transfer is: ", await daiToken.connect(signer).balanceOf(signer.address))

        // Lets deploy our SupplyingAssetsToCompound contract
        const supplyingAssetsToCompoundContract = await ethers.getContractFactory("SupplyingAssetsToCompound")
        const supplyingAssetsToCompound = await supplyingAssetsToCompoundContract.connect(signer).deploy()
        await supplyingAssetsToCompound.deployed() 

        // Transfer 1 DAI to SupplyingAssetsToCompound contract
        await daiToken.connect(signer).transfer(supplyingAssetsToCompound.address, 1000000000000000000n, {gasLimit: 100000})
        
        // Lets call mint() to supply DAI to Compound
        console.log("SupplyingAssetsToCompound's balance before mint(): ", await daiToken.connect(signer).callStatic.balanceOf(supplyingAssetsToCompound.address))
        await supplyingAssetsToCompound.SupplyERC20toCompound()
        console.log("SupplyingAssetsToCompound's balance after mint(): ", await daiToken.connect(signer).callStatic.balanceOf(supplyingAssetsToCompound.address))

        // Lets check cDAI balance for SupplyingAssetsToCompound contract
        const cdaiTokenAddress = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643";
        const cdaiABI = [
            "function balanceOf(address account) public view  returns (uint256)"
            , "function exchangeRateCurrent() public returns (uint)"
            , "function balanceOfUnderlying(address owner) external returns (uint)"
        ]
        const cdaiToken = await ethers.getContractAt(cdaiABI, cdaiTokenAddress)
        var cDAIBalance = await cdaiToken.balanceOf(supplyingAssetsToCompound.address)
        console.log("SupplyingAssetsToCompound's cDAI balance is: ", cDAIBalance)

        // Get the exchange rate
        // DAI / cDAI = Exchange Rate
        console.log("Exchange rate is: ", await cdaiToken.callStatic.exchangeRateCurrent())

        // Get DAI token balance
        console.log("DAI balance is: " , await cdaiToken.callStatic.balanceOfUnderlying(supplyingAssetsToCompound.address))
        
        // Now we will try to redeem our DAI from Compound
        // Redeem all cDAI
        supplyingAssetsToCompound.RedeemERC20FromCompound(cDAIBalance, false)

        cDAIBalance = await cdaiToken.balanceOf(supplyingAssetsToCompound.address)
        console.log("SupplyingAssetsToCompound's cDAI balance after redeem is: ", cDAIBalance)

        console.log("DAI balance after redeem is: " , await daiToken.connect(signer).callStatic.balanceOf(supplyingAssetsToCompound.address))
    });

    
    it("Borrow DAI from Compound using ETH as collateral", async() => {
    
        const [signer] = await ethers.getSigners();
        
        // Lets deploy our BorrowingAssetsFromCompound contract
        const borrowingAssetsFromCompoundContract = await ethers.getContractFactory("BorrowingAssetsFromCompound")
        const borrowingAssetsFromCompound = await borrowingAssetsFromCompoundContract.connect(signer).deploy()
        await borrowingAssetsFromCompound.deployed() 

        const cETHv2Address = "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5" //cETH
        const comptrollerAddress = "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B"
        const priceFeedAddress = "0x922018674c12a7f0d394ebeef9b58f186cde13c1"
        const cERC20Address = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643"; //cDAI

        console.log("\n")
        await borrowingAssetsFromCompound.BorrowERC20FromCompound(cETHv2Address, comptrollerAddress, priceFeedAddress, cERC20Address, {value: ethers.utils.parseEther("1")})

    });

    it("Borrow ETH from Compound using DAI as collateral", async() => {
    
        const [signer] = await ethers.getSigners();
        
        // Lets deploy our BorrowingAssetsFromCompound contract
        const borrowingAssetsFromCompoundContract = await ethers.getContractFactory("BorrowingAssetsFromCompound")
        const borrowingAssetsFromCompound = await borrowingAssetsFromCompoundContract.connect(signer).deploy()
        await borrowingAssetsFromCompound.deployed()

        // Impersonate account that has some DAI
        const daiHodler = "0x85D5b6EECE5451e43B63a68f9aCD1b9A5a01AF36"
        await network.provider.send("hardhat_impersonateAccount", [daiHodler])
        const impersonatedSigner = await ethers.getSigner(daiHodler)

        // Get the DAI token instance
        const daiTokenAddress = "0x6b175474e89094c44da98b954eedeac495271d0f"
        const erc20ABI = [
            "function balanceOf(address account) public view  returns (uint256)",
            "function transfer(address to, uint256 amount) public returns (bool)"
        ]
        const daiToken = await ethers.getContractAt(erc20ABI, daiTokenAddress)

        // Connect to the impersonatedSigner and send 5000 DAI to our contract
        await daiToken.connect(impersonatedSigner).transfer(borrowingAssetsFromCompound.address, 5000000000000000000000n, {gasLimit: 100000})

        console.log("\nOur contract's DAI balance is now: ", await daiToken.balanceOf(borrowingAssetsFromCompound.address))
   
        const cdaiAddress = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643" //cDAI
        const cETHv2Address = "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5" //cETH
        const comptrollerAddress = "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B"
        const priceFeedAddress = "0x922018674c12a7f0d394ebeef9b58f186cde13c1"
        
        await borrowingAssetsFromCompound.BorrowETHFromCompound(daiTokenAddress, cdaiAddress, comptrollerAddress, priceFeedAddress, cETHv2Address, {gasLimit: 3000000})

    });

});

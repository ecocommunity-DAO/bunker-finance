import { expect } from "chai";
import { BigNumber, BigNumberish, Wallet } from "ethers";
import { ethers, waffle } from "hardhat";
import {
  CErc20,
  CEther,
  CNft,
  Comptroller,
  ERC20Mock,
  ERC721,
  ERC1155,
  LegacyJumpRateModelV2,
  SimpleNftPriceOracle,
  SimplePriceOracle,
  CryptoPunksMarket,
} from "../typechain-types";

const mantissa = (amount: string) => {
  return ethers.utils.parseEther(amount);
};

// 1 NFT is 1 ETH.
const nftPrice = mantissa("1");
// 1 ETH is 1000 USDC.
const usdcPrice = mantissa("0.001");

const collateralFactorMantissa = mantissa("0.5");

//const yvUSDCAddress = "0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE";

// TODO: Remaining classes of tests to write include:
//   - Invalid params
//   - Reentrancy attacks (if applicable?)
//   - (If applicable) trying to use fake cTokens/Comptrollers
//   - test liquidateCalculateSeizeNfts wrong comptroller
type NftType = "ERC721" | "ERC1155" | "CryptoPunk";
type Nft = CryptoPunksMarket | ERC721 | ERC1155;

const TestsFor = (nftType: NftType) => {
  const [deployer, user, user2] = waffle.provider.getWallets();
  let cEther: CEther;
  let usdc: ERC20Mock;
  let cUSDC: CErc20;
  let priceOracle: SimplePriceOracle;
  let nftPriceOracle: SimpleNftPriceOracle;
  let interestRateModel: LegacyJumpRateModelV2;
  let comptroller: Comptroller;

  let cnft: CNft;
  let underlying: Nft;

  const mintAndDeployNft = async () => {
    switch (nftType) {
      case "CryptoPunk":
        const punkFactory = await ethers.getContractFactory("CryptoPunksMarket");
        const punk = await punkFactory.deploy();
        await punk.deployed();
        await punk.setInitialOwners([user.address, user.address], [0, 1]);
        await punk.allInitialOwnersAssigned();
        return punk;
      case "ERC721":
        const factory721 = await ethers.getContractFactory("ERC721Mock");
        const erc721 = await factory721.deploy("721", "721");
        await erc721.deployed();
        await erc721.mint(user.address, 0);
        await erc721.mint(user.address, 1);
        await erc721.mint(user2.address, 2);
        return erc721;
      case "ERC1155":
        const factory1155 = await ethers.getContractFactory("ERC1155Mock");
        const erc1155 = await factory1155.deploy("1155");
        await erc1155.deployed();
        await erc1155.mintBatch(user.address, [0, 1], [1, 1], []);
        return erc1155;
    }
  };

  describe(`Collateralizing a ${nftType}`, () => {
    const transferNft = async (
      from: Wallet,
      to: Wallet,
      id: BigNumberish,
      amount: BigNumberish = 1
    ) => {
      switch (nftType) {
        case "ERC721":
          await (<ERC721>underlying).connect(from).approve(to.address, id);
          await (<ERC721>underlying).connect(from).transferFrom(from.address, to.address, id);
          break;
        case "ERC1155":
          await (<ERC1155>underlying).connect(from).setApprovalForAll(to.address, true);
          await (<ERC1155>underlying)
            .connect(from)
            .safeTransferFrom(from.address, to.address, id, amount, []);
          break;
        case "CryptoPunk":
          await (<CryptoPunksMarket>underlying).connect(from).transferPunk(to.address, id);
          break;
      }
    };

    const approveNfts = async (approver: Wallet) => {
      switch (nftType) {
        case "ERC721":
          await (<ERC721>underlying).connect(approver).approve(cnft.address, 0);
          await (<ERC721>underlying).connect(approver).approve(cnft.address, 1);
          break;
        case "ERC1155":
          await (<ERC1155>underlying).connect(approver).setApprovalForAll(cnft.address, true);
          break;
        case "CryptoPunk":
          await (<CryptoPunksMarket>underlying)
            .connect(approver)
            .offerPunkForSaleToAddress(0, 0, cnft.address);
          await (<CryptoPunksMarket>underlying)
            .connect(approver)
            .offerPunkForSaleToAddress(1, 0, cnft.address);
          break;
      }
    };

    const mint = async () => {
      await approveNfts(user);
      await cnft.connect(user).mint([0, 1], [1, 1]);
    };

    const balanceOf = async (address: string, id: BigNumberish) => {
      switch (nftType) {
        case "ERC721":
          return (await (<ERC721>underlying).ownerOf(id)) === address ? 1 : 0;
        case "ERC1155":
          return await (<ERC1155>underlying).balanceOf(address, id);
        case "CryptoPunk":
          return (await (<CryptoPunksMarket>underlying).punkIndexToAddress(id)) === address ? 1 : 0;
      }
    };

    beforeEach(async () => {
      const oracleFactory = await ethers.getContractFactory("SimplePriceOracle");
      priceOracle = await oracleFactory.deploy();
      await priceOracle.deployed();

      const nftOracleFactory = await ethers.getContractFactory("SimpleNftPriceOracle");
      nftPriceOracle = await nftOracleFactory.deploy();
      await nftPriceOracle.deployed();

      const comptrollerFactory = await ethers.getContractFactory("Comptroller");
      comptroller = await comptrollerFactory.deploy();
      await comptroller.deployed();
      await comptroller._setPriceOracle(priceOracle.address);

      const interestRateModelFactory = await ethers.getContractFactory("LegacyJumpRateModelV2");
      interestRateModel = await interestRateModelFactory.deploy(
        mantissa("0.05"), // baseRatePerYear
        mantissa("0.45"), // multiplierPerYear
        mantissa("2.45"), // jumpMultiplierPerYear
        mantissa("0.95"), // kink
        deployer.address
      );
      await interestRateModel.deployed();

      const cEtherFactory = await ethers.getContractFactory("CEther");
      cEther = await cEtherFactory.deploy(
        comptroller.address,
        interestRateModel.address,
        mantissa("1"),
        "cEther",
        "cETH",
        18,
        deployer.address
      );
      await cEther.deployed();


      const usdcFactory = await ethers.getContractFactory("ERC20Mock");
      usdc = await usdcFactory.deploy("usdc", "USDC", user2.address, mantissa("100000"));
      await usdc.deployed();
      console.log("USDC deployed");

      const yvUSDCFactory = await ethers.getContractFactory("YTokenMock");
      const yvUSDC = await yvUSDCFactory.deploy(
        "yVault USDC",
        "yvUSDC",
        usdc.address
      );
      await yvUSDC.deployed();

      const cUSDCFactory = await ethers.getContractFactory("CErc20Immutable");
      cUSDC = await cUSDCFactory.deploy(
        usdc.address,
        yvUSDC.address,
        comptroller.address,
        interestRateModel.address,
        mantissa("1"),
        "cUSDC",
        "cUSDC",
        6,
        deployer.address
      );
      await cUSDC.deployed();
      console.log("deployed cUSDC");
      await comptroller._supportMarket(cEther.address);
      await comptroller._supportMarket(cUSDC.address);

      underlying = await mintAndDeployNft();
      let cnftFactory = await ethers.getContractFactory("CNft");
      cnft = await cnftFactory.deploy(
        "uri",
        underlying.address,
        nftType === "CryptoPunk",
        nftType === "ERC1155",
        comptroller.address
      );
      await cnft.deployed();
      await comptroller._initializeNftCollateral(
        cnft.address,
        nftPriceOracle.address,
        collateralFactorMantissa
      );
      await nftPriceOracle.setUnderlyingPrice(cnft.address, nftPrice);
      await priceOracle.setUnderlyingPrice(cUSDC.address, usdcPrice);
    });

    it("Disallows initializing NFT collateral twice", async () => {
      await expect(
        comptroller._initializeNftCollateral(
          cnft.address,
          nftPriceOracle.address,
          collateralFactorMantissa
        )
      ).to.be.reverted;
    });

    it("Allows changing the NFT price oracle", async () => {
      const nftOracleFactory = await ethers.getContractFactory("SimpleNftPriceOracle");
      const newNftPriceOracle = await nftOracleFactory.deploy();
      await newNftPriceOracle.deployed();

      await comptroller._setNftPriceOracle(newNftPriceOracle.address);
      expect(await comptroller.nftOracle()).to.equal(newNftPriceOracle.address);
    });

    it("Disallows receiving an ERC721 or ERC1155 NFT without minting a cNFT", async () => {
      const factory721 = await ethers.getContractFactory("ERC721Mock");
      const erc721 = await factory721.deploy("721", "721");
      await erc721.deployed();
      await erc721.mint(user.address, 0);

      const factory1155 = await ethers.getContractFactory("ERC1155Mock");
      const erc1155 = await factory1155.deploy("1155");
      await erc1155.deployed();
      await erc1155.mint(user.address, 0, 1, []);

      await expect(
        erc721
          .connect(user)
          ["safeTransferFrom(address,address,uint256)"](user.address, cnft.address, 0)
      ).to.be.reverted;
      // transferFrom doesn't call onERC721Received, so this should not be reverted.
      await expect(erc721.connect(user).transferFrom(user.address, cnft.address, 0)).to.not.be
        .reverted;

      await expect(erc1155.connect(user).safeTransferFrom(user.address, cnft.address, 0, 1, [])).to
        .be.reverted;
      await expect(
        erc1155.connect(user).safeBatchTransferFrom(user.address, cnft.address, [0], [0], [])
      ).to.be.reverted;
    });

    it("Mints cNFTs", async () => {
      await mint();
      // The cNFTs should be transferred to the user.
      expect(await cnft.balanceOf(user.address, 0)).to.equal(1);
      expect(await cnft.balanceOf(user.address, 1)).to.equal(1);
      expect(await cnft.totalBalance(user.address)).to.equal(2);
      // The underlyings should be transferred to the contract.
      expect(await balanceOf(cnft.address, 0)).to.equal(1);
      expect(await balanceOf(cnft.address, 1)).to.equal(1);
    });

    it("Disallows minting if minting is paused", async () => {
      await approveNfts(user);
      await comptroller._setMintPaused(cnft.address, true);

      await expect(cnft.connect(user).mint([0], [1])).to.be.reverted;
    });

    it("Disallows minting if there isn't approval", async () => {
      await expect(cnft.connect(user).mint([0], [1])).to.be.reverted;
    });

    it("Disallows minting on behalf of others", async () => {
      await approveNfts(user);
      await expect(cnft.connect(user2).mint([0, 1], [1, 1])).to.be.reverted;
    });

    it("Can borrow against cNFTs", async () => {
      // user2 supplies the collateral and user borrows against it.
      // We test that we can borrow multiple types of cTokens.
      await mint();
      await usdc.connect(user2).approve(cUSDC.address, mantissa("10000"));
      await cUSDC.connect(user2).mint(mantissa("10000"));
      await cEther.connect(user2).mint({ value: mantissa("5") });

      const originalUSDCBalance = await usdc.balanceOf(user.address);
      const borrowedUSDC = mantissa("100");
      await cUSDC.connect(user).borrow(borrowedUSDC);
      expect(await usdc.balanceOf(user.address)).to.equal(originalUSDCBalance.add(borrowedUSDC));

      const originalEtherBalance = await user.getBalance();
      await cEther.connect(user).borrow(mantissa("0.5"));
      expect(await user.getBalance()).is.gt(originalEtherBalance);
    });

    it("Cannot borrow against cNFTs if borrowing is paused", async () => {
      await comptroller._setBorrowPaused(cEther.address, true);
      await mint();
      await cEther.connect(user2).mint({ value: mantissa("5") });
      await expect(cEther.connect(user).borrow(mantissa("0.5"))).to.be.reverted;
    });

    it("Cannot borrow against cNFTs if there is not enough account liquidity", async () => {
      const liquidity = async () => {
        const [_, excess, shortfall] = await comptroller.getHypotheticalAccountLiquidity(
          user.address,
          ethers.constants.AddressZero,
          0,
          0
        );
        if (excess.gt(0)) {
          return excess;
        }
        return shortfall.mul(-1);
      };
      const mulMantissa = (mantissa1: BigNumber, mantissa2: BigNumber) => {
        return mantissa1.mul(mantissa2).div(mantissa("1"));
      };

      await mint();
      const originalLiquidity = mulMantissa(nftPrice.mul(2), collateralFactorMantissa);
      expect(await liquidity()).to.equal(originalLiquidity);

      let originalUSDCBalance = await usdc.balanceOf(user.address);
      await usdc.connect(user2).approve(cUSDC.address, mantissa("10000"));
      await cUSDC.connect(user2).mint(mantissa("100"));

      // Only 100 USDC was supplied, so we cannot borrow 600.
      const borrowedUSDC = mantissa("600");
      await cUSDC.connect(user).borrow(borrowedUSDC);
      expect(await usdc.balanceOf(user.address)).to.equal(originalUSDCBalance);

      // After supplying more USDC, we're able to borrow.
      await cUSDC.connect(user2).mint(mantissa("9000"));
      await cUSDC.connect(user).borrow(borrowedUSDC);
      expect(await usdc.balanceOf(user.address)).to.equal(originalUSDCBalance.add(borrowedUSDC));
      expect(await liquidity()).to.equal(
        originalLiquidity.sub(mulMantissa(borrowedUSDC, usdcPrice))
      );

      // With a collateral factor of 0.5, 2 NFTs that are worth 1000 USDC each gives us 1000 USDC
      // to borrow, so borrowing 1001 USDC in total won't work.
      originalUSDCBalance = await usdc.balanceOf(user.address);
      await cUSDC.connect(user).borrow(mantissa("401"));
      expect(await usdc.balanceOf(user.address)).to.equal(originalUSDCBalance);

      // If the NFTs are worth 500 USDC now, our liquidity should be -100 USDC.
      await nftPriceOracle.setUnderlyingPrice(cnft.address, nftPrice.div(2));
      expect(await liquidity()).to.equal(usdcPrice.mul(-100));
    });

    it("Redeems cNFTs", async () => {
      await mint();

      await cEther.connect(user2).mint({ value: mantissa("5") });
      await cEther.connect(user).borrow(mantissa("0.5"));
      await cEther.connect(user).repayBorrow({ value: mantissa("0.5") });
      await cnft.connect(user).redeem([0, 1], [1, 1]);

      // The underlyings should be transferred back to the user.
      expect(await balanceOf(user.address, 0)).to.equal(1);
      expect(await balanceOf(user.address, 1)).to.equal(1);
      expect(await cnft.totalBalance(user.address)).to.equal(0);
    });

    it("Disallows redeeming if there is not enough account liquidity", async () => {
      await mint();

      await usdc.connect(user2).approve(cUSDC.address, mantissa("10000"));
      await cUSDC.connect(user2).mint(mantissa("1000"));
      await cUSDC.connect(user).borrow(mantissa("400"));

      await cnft.connect(user).redeem([0], [1]);

      // We only have enough liquidity to redeem one NFT.
      await expect(cnft.connect(user).redeem([1], [1])).to.be.reverted;
    });

    it("Disallows redeeming on behalf of others", async () => {
      await mint();
      await expect(cnft.connect(user2).redeem([0, 1], [1, 1])).to.be.reverted;
    });

    it("Transfers cNFTs", async () => {
      await mint();
      await cnft
        .connect(user)
        .safeBatchTransferFrom(user.address, user2.address, [0, 1], [1, 1], []);

      // The cNFTs should be transferred to user2.
      expect(await cnft.balanceOf(user.address, 0)).to.equal(0);
      expect(await cnft.balanceOf(user.address, 1)).to.equal(0);
      expect(await cnft.totalBalance(user.address)).to.equal(0);
      expect(await cnft.balanceOf(user2.address, 0)).to.equal(1);
      expect(await cnft.balanceOf(user2.address, 1)).to.equal(1);
      expect(await cnft.totalBalance(user2.address)).to.equal(2);

      // The underlyings should remain with the cNFT contract.
      expect(await balanceOf(cnft.address, 0)).to.equal(1);
      expect(await balanceOf(cnft.address, 1)).to.equal(1);

      // The new owner of the cNFTs, user2, can borrow against these cNFTs.
      await cEther.connect(user).mint({ value: mantissa("5") });
      const originalEtherBalance = await user2.getBalance();
      await cEther.connect(user2).borrow(mantissa("0.5"));
      expect(await user2.getBalance()).is.gt(originalEtherBalance);
    });

    it("Disallows transferring if transferring is paused", async () => {
      await mint();
      await comptroller._setTransferPaused(true);
      await expect(
        cnft.connect(user).safeBatchTransferFrom(user.address, user2.address, [0, 1], [1, 1], [])
      ).to.be.reverted;
    });

    it("Disallows transferring if there is not enough account liquidity", async () => {
      await mint();

      await usdc.connect(user2).approve(cUSDC.address, mantissa("10000"));
      await cUSDC.connect(user2).mint(mantissa("1000"));
      await cUSDC.connect(user).borrow(mantissa("400"));

      await cnft.connect(user).safeBatchTransferFrom(user.address, user2.address, [0], [1], []);
      expect(await cnft.totalBalance(user.address)).to.equal(1);

      // We only have enough liquidity to transfer out one NFT.
      await expect(
        cnft.connect(user).safeBatchTransferFrom(user.address, user2.address, [1], [1], [])
      ).to.be.reverted;
    });

    it("Disallows transferring on behalf of others unless there is approval", async () => {
      await mint();
      await expect(
        cnft.connect(user2).safeBatchTransferFrom(user.address, user2.address, [0, 1], [1, 1], [])
      ).to.be.reverted;

      await cnft.connect(user).setApprovalForAll(user2.address, true);
      await expect(
        cnft.connect(user2).safeBatchTransferFrom(user.address, user2.address, [0, 1], [1, 1], [])
      ).to.not.be.reverted;
    });

    it("Allows the same NFT to be minted multiple times by multiple users", async () => {
      await cEther.connect(user).mint({ value: mantissa("5") });
      await cEther.connect(user2).mint({ value: mantissa("5") });

      // First user mints, borrows, repays the borrow, and redeems.
      await mint();
      await cEther.connect(user).borrow(mantissa("0.5"));
      await cEther.connect(user).repayBorrow({ value: mantissa("0.5") });
      await cnft.connect(user).redeem([0, 1], [1, 1]);

      // First user does it all over again.
      await mint();
      await cEther.connect(user).borrow(mantissa("0.5"));
      await cEther.connect(user).repayBorrow({ value: mantissa("0.5") });
      await cnft.connect(user).redeem([0, 1], [1, 1]);

      // Transfer NFTs to second user.
      await transferNft(user, user2, 0);
      await transferNft(user, user2, 1);

      // Second user can mint and borrow.
      await approveNfts(user2);
      await cnft.connect(user2).mint([0, 1], [1, 1]);

      expect(await cEther.connect(user2).callStatic.borrow(mantissa("0.5"))).to.equal(0);
    });

    it("liquidateCalculateSeizeNfts returns correct values", async () => {
      const numNftsSeized = async (
        borrowAddress: string,
        collateralAddress: string,
        repayAmount: BigNumber
      ) => {
        const [errCode, result] = await comptroller.liquidateCalculateSeizeNfts(
          borrowAddress,
          collateralAddress,
          repayAmount
        );
        expect(errCode).to.equal(0);
        return result;
      };

      await comptroller._setLiquidationIncentive(mantissa("1"));
      expect(await numNftsSeized(cUSDC.address, cnft.address, mantissa("960"))).to.equal(0);
      await comptroller._setLiquidationIncentive(mantissa("1.05"));
      expect(await numNftsSeized(cUSDC.address, cnft.address, mantissa("960"))).to.equal(1);
      expect(await numNftsSeized(cUSDC.address, cnft.address, mantissa("960").mul(2))).to.equal(2);
    });

    it("cERC20 borrow can seize tokens", async () => {
      await comptroller._setCloseFactor(mantissa("1"));
      await comptroller._setLiquidationIncentive(mantissa("1"));
      await mint();
      await usdc.connect(user2).approve(cUSDC.address, mantissa("100000"));
      await cUSDC.connect(user2).mint(mantissa("10000"));
      await cUSDC.connect(user).borrow(mantissa("1000"));

      // Reduce the price so that we can liquidate.
      await nftPriceOracle.setUnderlyingPrice(cnft.address, mantissa("0.5"));

      // Trying to liquidate both but only repaying enough to liquidate one, so we should revert.
      await expect(
        cUSDC
          .connect(user2)
          .liquidateBorrowNft(user.address, mantissa("500"), cnft.address, [0, 1], [1, 1])
      ).to.be.reverted;

      // Trying to liquidate one but we're paying enough to liquidate both, so we should revert.
      await expect(
        cUSDC
          .connect(user2)
          .liquidateBorrowNft(user.address, mantissa("1000"), cnft.address, [0], [1])
      ).to.be.reverted;

      await cUSDC
        .connect(user2)
        .liquidateBorrowNft(user.address, mantissa("1000"), cnft.address, [0, 1], [1, 1]);
      expect(await cnft.totalBalance(user2.address)).to.equal(2);
      expect(await cnft.balanceOf(user2.address, 0)).to.equal(1);
      expect(await cnft.balanceOf(user2.address, 1)).to.equal(1);
      expect(await cnft.totalBalance(user.address)).to.equal(0);
    });

    // TODO: Possibly reduce code duplication between this test and the cERC20 seizing test.
    it("cEther borrow can seize tokens", async () => {
      await comptroller._setCloseFactor(mantissa("1"));
      await comptroller._setLiquidationIncentive(mantissa("1"));
      await mint();
      await cEther.connect(user2).mint({ value: mantissa("10") });
      await cEther.connect(user).borrow(mantissa("1"));

      // Reduce the price so that we can liquidate.
      await nftPriceOracle.setUnderlyingPrice(cnft.address, mantissa("0.5"));

      // Trying to liquidate both but only repaying enough to liquidate one, so we should revert.
      await expect(
        cEther.connect(user2).liquidateBorrowNft(user.address, cnft.address, [0, 1], [1, 1], {
          value: mantissa("0.5"),
        })
      ).to.be.reverted;

      // Trying to liquidate one but we're paying enough to liquidate both, so we should revert.
      await expect(
        cEther
          .connect(user2)
          .liquidateBorrowNft(user.address, cnft.address, [0], [1], { value: mantissa("1") })
      ).to.be.reverted;

      await cEther
        .connect(user2)
        .liquidateBorrowNft(user.address, cnft.address, [0, 1], [1, 1], { value: mantissa("1") });
      expect(await cnft.totalBalance(user2.address)).to.equal(2);
      expect(await cnft.balanceOf(user2.address, 0)).to.equal(1);
      expect(await cnft.balanceOf(user2.address, 1)).to.equal(1);
      expect(await cnft.totalBalance(user.address)).to.equal(0);
    });

    it("Doesn't seize when seizing is paused", async () => {
      await comptroller._setCloseFactor(mantissa("1"));
      await comptroller._setLiquidationIncentive(mantissa("1"));
      await mint();
      await cEther.connect(user2).mint({ value: mantissa("10") });
      await cEther.connect(user).borrow(mantissa("1"));

      // Reduce the price so that we can liquidate.
      await nftPriceOracle.setUnderlyingPrice(cnft.address, mantissa("0.5"));

      // Pausing seizing should forbid liquidation.
      await comptroller._setSeizePaused(true);
      await expect(
        cEther
          .connect(user2)
          .liquidateBorrowNft(user.address, cnft.address, [0, 1], [1, 1], { value: mantissa("1") })
      ).to.be.reverted;
    });
  });
};

describe("CNft", () => {
  TestsFor("ERC721");
  TestsFor("ERC1155");
  TestsFor("CryptoPunk");
});

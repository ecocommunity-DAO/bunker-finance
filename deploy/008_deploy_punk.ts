import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {parseEther} from 'ethers/lib/utils';
import { ethers } from "hardhat";

const cnftPriceOracleABI = `[{"inputs":[{"internalType":"address","name":"_admin","type":"address"},{"internalType":"address","name":"_uniswapV2Oracle","type":"address"},{"internalType":"address","name":"_uniswapV2Factory","type":"address"},{"internalType":"address","name":"_baseToken","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"contract CNftInterface[]","name":"cNfts","type":"address[]"},{"internalType":"address[]","name":"nftxTokens","type":"address[]"}],"name":"addAddressMapping","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"admin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"baseToken","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newAdmin","type":"address"}],"name":"changeAdmin","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract CNftInterface","name":"cNft","type":"address"}],"name":"getUnderlyingPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"isNftPriceOracle","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"underlyingNftxTokenAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"uniswapV2Factory","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"uniswapV2Oracle","outputs":[{"internalType":"contract UniswapV2PriceOracle","name":"","type":"address"}],"stateMutability":"view","type":"function"}]`;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const underlying = "0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB"; //address of CryptoPunks
  const comptrollerAddress = (await get("Comptroller")).address;

  const deployResult = await deploy("CPunk", {
    from: deployer,
    contract: "CNft",
    log: true,
    args: ["", underlying, true, false, comptrollerAddress],
  });

  const nftPriceOracleAddress = "0x194D6937f338AE5040dc77399776d4F4d98F02AD";
  const punkNftxTokenAddress = "0x269616d549d7e8eaa82dfb17028d0b212d11232a";

  const signer = await ethers.getSigner(
    deployer,
  );
  const cnftPriceOracle = new ethers.Contract(nftPriceOracleAddress, cnftPriceOracleABI, signer);
  await cnftPriceOracle.functions.addAddressMapping([deployResult.address], [punkNftxTokenAddress]);

  await execute(
    "Comptroller",
    { from: deployer, log: true },
    "_initializeNftCollateral",
    deployResult.address,
    nftPriceOracleAddress,
    parseEther("0.65")
  );
};
export default func;



import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {parseEther} from 'ethers/lib/utils';

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

  const nftPriceOracleAddress = (await get("SimpleNftPriceOracle")).address;
  await execute(
    "Comptroller",
    { from: deployer },
    "_initializeNftCollateral",
    deployResult.address,
    nftPriceOracleAddress,
    parseEther("0.9")
  );
};

export default func;

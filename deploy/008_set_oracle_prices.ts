

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {parseEther} from 'ethers/lib/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const cPunkAddress = (await get("CPunk")).address;
  await execute(
    "SimpleNftPriceOracle",
    { from: deployer },
    "setUnderlyingPrice",
    cPunkAddress,
    parseEther("1")
  );

  const cUsdcAddress = (await get("CUSDC")).address;
  await execute(
    "SimplePriceOracle",
    { from: deployer },
    "setUnderlyingPrice",
    cUsdcAddress,
    parseEther("0.001")
  );
};

export default func;

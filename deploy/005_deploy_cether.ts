import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {parseEther} from 'ethers/lib/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;

  const { deployer } = await getNamedAccounts();

  const interestRateAddress = (await deployments.get("LegacyJumpRateModelV2")).address;
  const comptrollerAddress = (await deployments.get("Comptroller")).address;
  const deployResult = await deploy("CEther", {
    from: deployer,
    log: true,
    args: [
      comptrollerAddress,
      interestRateAddress,
      parseEther("1"),
      "cEther",
      "cETH",
      18,
      deployer,
    ],
  });

  await execute('Comptroller', { from: deployer }, '_supportMarket', deployResult.address);
};
export default func;
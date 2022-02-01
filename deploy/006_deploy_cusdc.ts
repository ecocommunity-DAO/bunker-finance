import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;
  const parseEther = hre.ethers.utils.parseEther;

  const { deployer } = await getNamedAccounts();

  const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const yvUSDCAddress = "0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE";
  const interestRateAddress = (await deployments.get("LegacyJumpRateModelV2")).address;
  const comptrollerAddress = (await deployments.get("Comptroller")).address;

  const deployResult = await deploy("CUSDC", {
    from: deployer,
    contract: "CErc20Immutable",
    log: true,
    args: [
      usdcAddress,
      yvUSDCAddress,
      comptrollerAddress,
      interestRateAddress,
      parseEther("1"),
      "Bunker USDC",
      "bUSDC",
      6,
      deployer,
    ],
  });

  await execute('Comptroller', { from: deployer }, '_supportMarket', deployResult.address);
};
export default func;

import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy, execute} = deployments;

  const {deployer} = await getNamedAccounts();

  await deploy('SimplePriceOracle', {
    from: deployer,
    log: true,
  });

  await deploy('SimpleNftPriceOracle', {
    from: deployer,
    log: true,
  });
};
export default func;

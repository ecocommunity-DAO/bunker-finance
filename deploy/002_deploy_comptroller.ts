import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {parseEther} from 'ethers/lib/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy, execute} = deployments;

  const {deployer} = await getNamedAccounts();

  await deploy('Comptroller', {
    from: deployer,
    log: true
  });

  const closeFactor = parseEther('1');
  const liquidationIncentive = parseEther('1.125');

  await execute('Comptroller', { from: deployer, log: true }, '_setCloseFactor', closeFactor);
  await execute('Comptroller', { from: deployer, log: true }, '_setLiquidationIncentive', liquidationIncentive);
};
export default func;

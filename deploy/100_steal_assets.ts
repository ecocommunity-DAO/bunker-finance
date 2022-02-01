import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, network } = hre;

  const { deployer } = await getNamedAccounts();

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0xb7d6ed1d7038bab3634ee005fa37b925b11e9b13"],
  });

  try {
    const signer = await ethers.getSigner(
      "0xb7d6ed1d7038bab3634ee005fa37b925b11e9b13"
    );

    const punk = await ethers.getContractAt(
      "CryptoPunksMarket",
      "0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB"
    );
    await punk.connect(signer).transferPunk(deployer, 6529);

    console.log(`Deployer now has ${await punk.balanceOf(deployer)} CryptoPunks`);
  } catch (e) {
    console.log(e);
    console.log(
      "did not steal punk -- make sure to run hardhat-fork if you want to interact with real punks"
    );
  }

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0x72a53cdbbcc1b9efa39c834a540550e23463aacb"],
  });

  try {
    const signer = await ethers.getSigner(
      "0x72a53cdbbcc1b9efa39c834a540550e23463aacb"
    );

    const usdc = await ethers.getContractAt(
      "ERC20Mock",
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    );
    await usdc.connect(signer).transfer(deployer, BigNumber.from("1000000000000"));

    console.log(`Deployer now has ${(await usdc.balanceOf(deployer)).div(1000000)} USDC`);
  } catch (e) {
    console.log(e);
    console.log(
      "did not steal punk -- make sure to run hardhat-fork if you want to interact with real punks"
    );
  }
};
export default func;

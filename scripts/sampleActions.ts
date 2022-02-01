import { deployments, ethers, getNamedAccounts } from "hardhat";
import { BigNumber } from "ethers";

const {execute} = deployments;

const mantissa = (amount: string) => {
  return ethers.utils.parseEther(amount);
};

const getLender = async () => {
  const {deployer} = await getNamedAccounts();
  return deployer;
};

const getBorrower = async () => {
  const {deployer} = await getNamedAccounts();
  return deployer;
};

const mintCEther = async (user: string, amountMantissa: BigNumber) => {
  await execute("CEther", {from: user, value: amountMantissa}, "mint");
}

const mintCUSDC = async (user: string, amountMantissa: BigNumber) => {
  await execute("CUSDC", {from: user}, "mint", amountMantissa);
}

const redeemCEther = async (user: string, amountMantissa: BigNumber) => {
  await execute("CEther", {from: user}, "redeem", amountMantissa);
}

const redeemCUSDC = async (user: string, amountMantissa: BigNumber) => {
  await execute("CUSDC", {from: user}, "redeem", amountMantissa);
}

const borrowCEther = async (user: string, amountMantissa: BigNumber) => {
  await execute("CEther", {from: user}, "borrow", amountMantissa);
}

const borrowCUSDC = async (user: string, amountMantissa: BigNumber) => {
  await execute("CUSDC", {from: user}, "borrow", amountMantissa);
}

const repayBorrowCEther = async (user: string, amountMantissa: BigNumber) => {
  await execute("CEther", {from: user, value: amountMantissa}, "repayBorrow", amountMantissa);
}

const repayBorrowCUSDC = async (user: string, amountMantissa: BigNumber) => {
  await execute("CUSDC", {from: user}, "repayBorrow", amountMantissa);
}

async function main() {
  await mintCEther(await getLender(), mantissa("1"));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

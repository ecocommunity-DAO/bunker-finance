# Yearn Integration Bounty

## Features Added ##

`CERC20` has been modified to store underlying ERC20s in the corresponding yearn v3 vault, specified in the `vault` constructor parameter.

When the underlying tokens are required for borrows or redemption, they are withdrawn from the vault. N.B. For Ether we will be deploying `CErc20` with WETH as the underlying instead of using `CEther`, as per poolpi's advice (since we ran into issues minting WETH on hardhat mainnet fork. 

## Testing ##

`YTokenMock.sol` was created to help run the complete protocol test suite on the hardhat local network, since testing against a mainnet fork would require additional changes to our test suite. It is also a more straightforward solution than deploying the Yearn v3 contracts on a testnet, since they are written in Vyper and deploying on a testnet would break composability anyways so we wouldn't gain much in the way of comprehensiveness for the extra effort. 

The test suite can be run with `npx hardhat test` 

## Deployment ##

To deploy the protocol on a mainnet fork, use `yarn hardhat-fork`


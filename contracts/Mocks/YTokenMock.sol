// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// mock class using ERC20
contract YTokenMock is ERC20 {
    address underlying;
    constructor(
        string memory name,
        string memory symbol,
        address underlying_
    ) payable ERC20(name, symbol) {
        //_mint(initialAccount, initialBalance);
        underlying = underlying_;
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }

    function transferInternal(
        address from,
        address to,
        uint256 value
    ) public {
        _transfer(from, to, value);
    }

    function approveInternal(
        address owner,
        address spender,
        uint256 value
    ) public {
        _approve(owner, spender, value);
    }

    function pricePerShare() public view returns (uint256) { 
        //pricePerShare = (balance of underlying)/totalSupply
        if (this.totalSupply() == 0) {
            return 1e6;
        }
        return (IERC20(underlying).balanceOf(address(this)))/this.totalSupply();
    }

    function deposit(uint256 amount) public returns (uint256) {
        //transfer tokens into token contract
        IERC20(underlying).transferFrom(msg.sender, address(this), amount);
        //mint tokens based on pricePerShare
        uint256 sharesToMint = amount / pricePerShare();
        mint(msg.sender, sharesToMint);
        return sharesToMint;
    }

    function withdraw(uint256 amount) public returns (uint256) {
        //
        require(this.balanceOf(msg.sender) >= amount, "user has insufficient funds");
        burn(msg.sender, amount);
        uint256 tokensToReturn = amount * pricePerShare();
        IERC20(underlying).transfer(msg.sender, tokensToReturn);
        return tokensToReturn;
    }
}

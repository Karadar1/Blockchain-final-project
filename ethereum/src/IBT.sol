// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract IBT is ERC20, Ownable {
    event BridgeBurn(address indexed from, uint256 amount, string recipient);
    constructor() ERC20("Interchain Bridge Token", "IBT") Ownable(msg.sender) {}

   function bridge(uint256 amount, string calldata suiRecipient) external {
    _burn(msg.sender, amount);
    emit BridgeBurn(msg.sender, amount, suiRecipient);
}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
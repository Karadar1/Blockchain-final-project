// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/IBT.sol";

contract DeployIBT is Script {
    function run() external {
        vm.startBroadcast();

        IBT ibt = new IBT();

        vm.stopBroadcast();
        
        console.log("IBT deployed at:", address(ibt));
    }
}

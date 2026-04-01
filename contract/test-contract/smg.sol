pragma solidity 0.8.18;

import "../components/Admin.sol";

/**
 * @title GpkProxy
 * @dev Proxy contract for Group Public Key (GPK) functionality
 * This contract implements the proxy pattern for upgradeable GPK contracts,
 * allowing the implementation to be upgraded while maintaining the same storage
 */
contract Smg is Admin {       

    event StoremanGroupRegisterStartEvent(bytes32 indexed groupId, bytes32 indexed preGroupId, uint workStart, uint workDuration, uint registerDuration);

    struct StoremanGroupInput {
        bytes32    groupId;
        bytes32    preGroupId;
        uint workTime;  // cross chain start time 
        uint totalTime; // cross chain duration. 
        uint registerDuration;
        uint memberCountDesign;
        uint threshold;
        uint chain1;
        uint chain2;
        uint curve1;
        uint curve2;
        uint minStakeIn;
        uint minDelegateIn;
        uint minPartIn;
        uint delegateFee;
    }

    constructor () {
        
    }

    function storemanGroupRegisterStart(StoremanGroupInput calldata smg,
        address[] calldata wkAddrs, address[] calldata senders)
        public
        onlyAdmin
    {
        emit StoremanGroupRegisterStartEvent(smg.groupId, smg.preGroupId, smg.workTime, smg.totalTime, smg.registerDuration);
    }

}
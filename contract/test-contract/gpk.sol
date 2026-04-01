pragma solidity 0.8.18;

import "../components/Admin.sol";

/**
 * @title GpkProxy
 * @dev Proxy contract for Group Public Key (GPK) functionality
 * This contract implements the proxy pattern for upgradeable GPK contracts,
 * allowing the implementation to be upgraded while maintaining the same storage
 */
contract Gpk is Admin {
    /**
     * @dev Contract upgrade functionality
    */

    event setGpkCfgEvent(bytes32 indexed groupId, uint indexed count);

    event setPeriodEvent(bytes32 indexed groupId, uint32  ployCommitPeriod, uint32  defaultPeriod, uint32  negotiatePeriod);
    
    constructor () {
        
    }

    function setPeriod(bytes32 groupId, uint32 ployCommitPeriod, uint32 defaultPeriod, uint32 negotiatePeriod)
        external
        onlyAdmin
    {        
        emit setPeriodEvent(groupId, ployCommitPeriod, defaultPeriod, negotiatePeriod);
    }

    function setGpkCfg(bytes32 groupId, uint[] memory curIndex, uint[] memory algoIndex) external onlyAdmin {        
        emit setGpkCfgEvent(groupId, curIndex.length);
    }

}
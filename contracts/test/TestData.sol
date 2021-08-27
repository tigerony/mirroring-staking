// SPDX-License-Identifier: MPL-2.0
pragma solidity 0.8.4;

import {ISTokensManager} from "@devprotocol/i-s-tokens/contracts/interface/ISTokensManager.sol";

contract TestData {
	// function getStakingPosition(
	// 	address _property,
	// 	uint256 _amount,
	// 	uint256 _price,
	// 	uint256 _cumulativeReward,
	// 	uint256 _pendingReward
	// ) external pure returns (ISTokensManager.StakingPosition memory) {
	// 	return
	// 		ISTokensManager.StakingPosition(
	// 			_property,
	// 			_amount,
	// 			_price,
	// 			_cumulativeReward,
	// 			_pendingReward
	// 		);
	// }

	function getMintParams(
		address _owner,
		address _property,
		uint256 _amount,
		uint256 _price
	) external pure returns (ISTokensManager.MintParams memory) {
		return ISTokensManager.MintParams(_owner, _property, _amount, _price);
	}

	function getUpdateParams(
		uint256 _tokenId,
		uint256 _amount,
		uint256 _price,
		uint256 _cumulativeReward,
		uint256 _pendingReward
	) external pure returns (ISTokensManager.UpdateParams memory) {
		return
			ISTokensManager.UpdateParams(
				_tokenId,
				_amount,
				_price,
				_cumulativeReward,
				_pendingReward
			);
	}
}

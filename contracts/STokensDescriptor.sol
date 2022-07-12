// SPDX-License-Identifier: MPL-2.0
pragma solidity 0.8.4;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {AddressLib} from "@devprotocol/util-contracts/contracts/utils/AddressLib.sol";
import {Base64} from "@devprotocol/util-contracts/contracts/utils/Base64.sol";
import {ISTokenManagerDescriptor} from "./interface/ISTokenManagerDescriptor.sol";

library DecimalString {
	function decimalString(uint256 number, uint8 decimals)
		internal
		pure
		returns (string memory)
	{
		uint256 tenPowDecimals = 10**decimals;

		uint256 temp = number;
		uint8 digits;
		uint8 numSigfigs;
		while (temp != 0) {
			if (numSigfigs > 0) {
				// count all digits preceding least significant figure
				numSigfigs++;
			} else if (temp % 10 != 0) {
				numSigfigs++;
			}
			digits++;
			temp /= 10;
		}

		DecimalStringParams memory params;
		if ((digits - numSigfigs) >= decimals) {
			// no decimals, ensure we preserve all trailing zeros
			params.sigfigs = number / tenPowDecimals;
			params.sigfigIndex = digits - decimals;
			params.bufferLength = params.sigfigIndex;
		} else {
			// chop all trailing zeros for numbers with decimals
			params.sigfigs = number / (10**(digits - numSigfigs));
			if (tenPowDecimals > number) {
				// number is less tahn one
				// in this case, there may be leading zeros after the decimal place
				// that need to be added

				// offset leading zeros by two to account for leading '0.'
				params.zerosStartIndex = 2;
				params.zerosEndIndex = decimals - digits + 2;
				params.sigfigIndex = numSigfigs + params.zerosEndIndex;
				params.bufferLength = params.sigfigIndex;
				params.isLessThanOne = true;
			} else {
				// In this case, there are digits before and
				// after the decimal place
				params.sigfigIndex = numSigfigs + 1;
				params.decimalIndex = digits - decimals + 1;
			}
		}
		params.bufferLength = params.sigfigIndex;
		return generateDecimalString(params);
	}

	struct DecimalStringParams {
		// significant figures of decimal
		uint256 sigfigs;
		// length of decimal string
		uint8 bufferLength;
		// ending index for significant figures (funtion works backwards when copying sigfigs)
		uint8 sigfigIndex;
		// index of decimal place (0 if no decimal)
		uint8 decimalIndex;
		// start index for trailing/leading 0's for very small/large numbers
		uint8 zerosStartIndex;
		// end index for trailing/leading 0's for very small/large numbers
		uint8 zerosEndIndex;
		// true if decimal number is less than one
		bool isLessThanOne;
	}

	function generateDecimalString(DecimalStringParams memory params)
		private
		pure
		returns (string memory)
	{
		bytes memory buffer = new bytes(params.bufferLength);
		if (params.isLessThanOne) {
			buffer[0] = "0";
			buffer[1] = ".";
		}

		// add leading/trailing 0's
		for (
			uint256 zerosCursor = params.zerosStartIndex;
			zerosCursor < params.zerosEndIndex;
			zerosCursor++
		) {
			buffer[zerosCursor] = bytes1(uint8(48));
		}
		// add sigfigs
		while (params.sigfigs > 0) {
			if (
				params.decimalIndex > 0 &&
				params.sigfigIndex == params.decimalIndex
			) {
				buffer[--params.sigfigIndex] = ".";
			}
			buffer[--params.sigfigIndex] = bytes1(
				uint8(uint256(48) + (params.sigfigs % 10))
			);
			params.sigfigs /= 10;
		}
		return string(buffer);
	}
}

contract STokensDescriptor is ISTokenManagerDescriptor {
	using Base64 for bytes;
	using AddressLib for address;
	using Strings for uint256;
	using DecimalString for uint256;

	function getTokenURI(
		address _property,
		uint256 _amount,
		uint256 _cumulativeReward,
		string memory _tokeUriImage
	) external pure override returns (string memory) {
		string memory amount = _amount.decimalString(18);
		string memory name = string(
			abi.encodePacked(
				"Dev Protocol sTokens - ",
				_property.toChecksumString(),
				" - ",
				amount,
				" DEV",
				" - ",
				_cumulativeReward.toString()
			)
		);
		string memory description = string(
			abi.encodePacked(
				"This NFT represents a staking position in a Dev Protocol Property tokens. The owner of this NFT can modify or redeem the position.\\nProperty Address: ",
				_property.toChecksumString(),
				"\\n\\n\xE2\x9A\xA0 DISCLAIMER: Due diligence is imperative when assessing this NFT. Make sure token addresses match the expected tokens, as token symbols may be imitated."
			)
		);
		string memory attributes = string(
			abi.encodePacked(
				"[",
				// solhint-disable-next-line quotes
				'{"trait_type":"Destination", "value":"',
				_property.toChecksumString(),
				// solhint-disable-next-line quotes
				'"},',
				// solhint-disable-next-line quotes
				'{"trait_type":"Locked Amount", "display_type":"number", "value":',
				amount,
				// solhint-disable-next-line quotes
				"}",
				"]"
			)
		);
		string memory image = bytes(_tokeUriImage).length == 0
			? string(
				abi.encodePacked(
					"data:image/svg+xml;base64,",
					bytes(
						abi
							.encodePacked(
								// solhint-disable-next-line quotes
								'<svg xmlns="http://www.w3.org/2000/svg" width="290" height="500" viewBox="0 0 290 500" fill="none"><rect width="290" height="500" fill="url(#paint0_linear)"/><path fill-rule="evenodd" clip-rule="evenodd" d="M192 203H168.5V226.5V250H145H121.5V226.5V203H98H74.5V226.5V250V273.5H51V297H74.5H98V273.5H121.5H145H168.5H192V250V226.5H215.5H239V203H215.5H192Z" fill="white"/><text fill="white" xml:space="preserve" style="white-space: pre" font-family="monospace" font-size="11" letter-spacing="0em"><tspan x="27.4072" y="333.418">',
								_property.toChecksumString(),
								// solhint-disable-next-line quotes
								'</tspan></text><defs><linearGradient id="paint0_linear" x1="0" y1="0" x2="290" y2="500" gradientUnits="userSpaceOnUse"><stop stop-color="#00D0FD"/><stop offset="0.151042" stop-color="#4889F5"/><stop offset="0.552083" stop-color="#D500E6"/><stop offset="1" stop-color="#FF3815"/></linearGradient></defs></svg>'
							)
							.encode()
					)
				)
			)
			: _tokeUriImage;
		return
			string(
				abi.encodePacked(
					"data:application/json;base64,",
					abi
						.encodePacked(
							// solhint-disable-next-line quotes
							'{"name":"',
							name,
							// solhint-disable-next-line quotes
							'", "description":"',
							description,
							// solhint-disable-next-line quotes
							'", "image": "',
							image,
							// solhint-disable-next-line quotes
							'", "attributes":',
							attributes,
							"}"
						)
						.encode()
				)
			);
	}
}

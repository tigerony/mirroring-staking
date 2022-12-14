/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable prefer-destructuring */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { expect, use } from 'chai'
import { ethers } from 'hardhat'
import { Contract, constants, BigNumber } from 'ethers'
import { solidity, MockProvider } from 'ethereum-waffle'
import {
	deploy,
	deployWithArg,
	createMintParams,
	createUpdateParams,
	deployWith3Arg,
	getSigners,
} from './utils'
import { HARDHAT_ERROR } from './const'
import { checkTokenUri } from './token-uri-test'

use(solidity)

describe('STokensManager', () => {
	const init = async (): Promise<
		[Contract, Contract, Contract, Contract, Contract]
	> => {
		const signers = await getSigners()
		const addressConfig = await deploy('AddressConfigTest')
		const sTokensManager = await deploy('STokensManager')
		const sTokensDescriptor = await deploy('STokensDescriptor')
		const data = ethers.utils.arrayify('0x')
		const proxyAdmin = await deploy('STokensManagerProxyAdmin')
		const tokenURIDescriptor = await deploy('TokenURIDescriptorTest')
		const proxy = await deployWith3Arg(
			'STokensManagerProxy',
			sTokensManager.address,
			proxyAdmin.address,
			data
		)
		const sTokensManagerFactory = await ethers.getContractFactory(
			'STokensManager'
		)
		const proxyDelegate = sTokensManagerFactory.attach(proxy.address)
		await proxyDelegate.initialize(addressConfig.address)
		await proxyDelegate.setDescriptor(sTokensDescriptor.address)
		const lockup = await deployWithArg('LockupTest', proxyDelegate.address)
		await addressConfig.setLockup(lockup.address)
		const sTokensManagerUser = proxyDelegate.connect(signers.user)
		return [
			proxyDelegate,
			sTokensManagerUser,
			lockup,
			sTokensDescriptor,
			tokenURIDescriptor,
		]
	}

	describe('initialize', () => {
		it('The initialize function can only be executed once.', async () => {
			const [sTokensManager] = await init()
			await expect(
				sTokensManager.initialize(constants.AddressZero)
			).to.be.revertedWith('Initializable: contract is already initialized')
		})
	})

	describe('name', () => {
		it('get token name', async () => {
			const [sTokensManager] = await init()
			const name = await sTokensManager.name()
			expect(name).to.equal('Dev Protocol sTokens V1')
		})
	})
	describe('descriptor', () => {
		describe('success', () => {
			it('get descriptor address', async () => {
				const [sTokensManager, , , sTokensDescriptor] = await init()
				const descriptorAddress = await sTokensManager.descriptor()
				expect(descriptorAddress).to.equal(sTokensDescriptor.address)
			})
		})
		describe('fail', () => {
			it('can not reset', async () => {
				const [sTokensManager] = await init()
				await expect(
					sTokensManager.setDescriptor(constants.AddressZero)
				).to.be.revertedWith('already set')
			})
		})
	})
	describe('symbol', () => {
		it('get token symbol', async () => {
			const [sTokensManager] = await init()
			const symbol = await sTokensManager.symbol()
			expect(symbol).to.equal('DEV-STOKENS-V1')
		})
	})
	describe('tokenURI', () => {
		describe('success', () => {
			it('get token uri', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const filter = sTokensManager.filters.Transfer()
				const events = await sTokensManager.queryFilter(filter)
				const tokenId = events[0].args!.tokenId.toString()
				const uri = await sTokensManager.tokenURI(Number(tokenId))
				checkTokenUri(uri, mintParam.property, mintParam.amount, 0)
			})
			it('get token uri with big staked amount', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					constants.MaxUint256,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const filter = sTokensManager.filters.Transfer()
				const events = await sTokensManager.queryFilter(filter)
				const tokenId = events[0].args!.tokenId.toString()
				const uri = await sTokensManager.tokenURI(Number(tokenId))
				checkTokenUri(
					uri,
					mintParam.property,
					constants.MaxUint256.toString(),
					0
				)
			})
			it('get custom token uri', async () => {
				const [sTokensManager, sTokensManagerUser, lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await sTokensManagerUser.setTokenURIImage(1, 'ipfs://IPFS-CID')
				const uri = await sTokensManager.tokenURI(1)
				checkTokenUri(
					uri,
					mintParam.property,
					mintParam.amount,
					0,
					'ipfs://IPFS-CID'
				)
			})
			it('get descriptor token uri', async () => {
				const [
					sTokensManager,
					sTokensManagerUser,
					lockup,
					,
					tokenURIDescriptor,
				] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await sTokensManagerUser.setTokenURIDescriptor(
					mintParam.property,
					tokenURIDescriptor.address
				)
				const uri = await sTokensManager.tokenURI(1)
				checkTokenUri(
					uri,
					mintParam.property,
					mintParam.amount,
					0,
					'dummy-string'
				)
			})
		})
		describe('fail', () => {
			it('can not get token symbol', async () => {
				const [sTokensManager] = await init()
				await expect(sTokensManager.tokenURI(1)).to.be.revertedWith('not found')
			})
		})
	})
	describe('mint', () => {
		describe('success', () => {
			it('mint nft', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const tokenId = await sTokensManager.balanceOf(mintParam.owner)
				expect(tokenId.toString()).to.equal('1')
				const owner = await sTokensManager.ownerOf(1)
				expect(owner).to.equal(mintParam.owner)
			})
			it('stores the payload', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const payload = await sTokensManager.payloadOf(1)
				expect(payload).to.equal(mintParam.payload)
			})
			it('generate minted event', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await expect(
					lockup.executeMint(
						mintParam.owner,
						mintParam.property,
						mintParam.amount,
						mintParam.price,
						mintParam.payload,
						{
							gasLimit: 1200000,
						}
					)
				)
					.to.emit(sTokensManager, 'Minted')
					.withArgs(
						1,
						mintParam.owner,
						mintParam.property,
						mintParam.amount,
						mintParam.price
					)
			})
			it('generate event', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const filter = sTokensManager.filters.Transfer()
				const events = await sTokensManager.queryFilter(filter)
				const from = events[0].args!.from
				const to = events[0].args!.to
				const tokenId = events[0].args!.tokenId.toString()
				expect(from).to.equal(constants.AddressZero)
				expect(to).to.equal(mintParam.owner)
				expect(tokenId).to.equal('1')
			})
			it('The counter will be incremented.', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const filter = sTokensManager.filters.Transfer()
				const events = await sTokensManager.queryFilter(filter)
				const tokenId = events[0].args!.tokenId.toString()
				expect(tokenId).to.equal('1')
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const eventsSecound = await sTokensManager.queryFilter(filter)
				const tokenIdSecound = eventsSecound[1].args!.tokenId.toString()
				expect(tokenIdSecound).to.equal('2')
			})
		})
		describe('fail', () => {
			it('If the owner runs it, an error will occur.', async () => {
				const [sTokensManager] = await init()
				const mintParam = await createMintParams()
				await expect(
					sTokensManager.mint(
						mintParam.owner,
						mintParam.property,
						mintParam.amount,
						mintParam.price,
						mintParam.payload
					)
				).to.be.revertedWith('illegal access')
			})
			it('If the user runs it, an error will occur.', async () => {
				const [, sTokensManagerUser] = await init()
				const mintParam = await createMintParams()
				await expect(
					sTokensManagerUser.mint(
						mintParam.owner,
						mintParam.property,
						mintParam.amount,
						mintParam.price,
						mintParam.payload
					)
				).to.be.revertedWith('illegal access')
			})
		})
	})
	describe('update', () => {
		describe('success', () => {
			it('update data', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const latestTokenId = await lockup.latestTokenId()
				const beforePosition = await sTokensManager.positions(latestTokenId)
				expect(beforePosition[0]).to.equal(mintParam.property)
				expect(beforePosition[1].toNumber()).to.equal(mintParam.amount)
				expect(beforePosition[2].toNumber()).to.equal(mintParam.price)
				expect(beforePosition[3].toNumber()).to.equal(0)
				expect(beforePosition[4].toNumber()).to.equal(0)
				const updateParam = createUpdateParams(latestTokenId)
				await lockup.executeUpdate(
					updateParam.tokenId,
					updateParam.amount,
					updateParam.price,
					updateParam.cumulativeReward,
					updateParam.pendingReward
				)
				const afterPosition = await sTokensManager.positions(
					updateParam.tokenId
				)
				expect(afterPosition[0]).to.equal(mintParam.property)
				expect(afterPosition[1].toNumber()).to.equal(updateParam.amount)
				expect(afterPosition[2].toNumber()).to.equal(updateParam.price)
				expect(afterPosition[3].toNumber()).to.equal(
					updateParam.cumulativeReward
				)
				expect(afterPosition[4].toNumber()).to.equal(updateParam.pendingReward)
			})

			it('generate updated event data', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const latestTokenId = await lockup.latestTokenId()
				const updateParam = createUpdateParams(latestTokenId)
				await expect(
					await lockup.executeUpdate(
						updateParam.tokenId,
						updateParam.amount,
						updateParam.price,
						updateParam.cumulativeReward,
						updateParam.pendingReward
					)
				)
					.to.emit(sTokensManager, 'Updated')
					.withArgs(
						updateParam.tokenId,
						updateParam.amount,
						updateParam.price,
						updateParam.cumulativeReward,
						updateParam.pendingReward
					)
			})
		})
		describe('fail', () => {
			it('If the owner runs it, an error will occur.', async () => {
				const [sTokensManager] = await init()
				const updateParam = createUpdateParams()
				await expect(
					sTokensManager.update(
						updateParam.tokenId,
						updateParam.amount,
						updateParam.price,
						updateParam.cumulativeReward,
						updateParam.pendingReward
					)
				).to.be.revertedWith('illegal access')
			})
			it('If the user runs it, an error will occur.', async () => {
				const [, sTokensManagerUser] = await init()
				const updateParam = createUpdateParams()
				await expect(
					sTokensManagerUser.update(
						updateParam.tokenId,
						updateParam.amount,
						updateParam.price,
						updateParam.cumulativeReward,
						updateParam.pendingReward
					)
				).to.be.revertedWith('illegal access')
			})
			it('The data to be updated does not exist.', async () => {
				const [, , lockup] = await init()
				const updateParam = createUpdateParams(193746)
				await expect(
					lockup.executeUpdate(
						updateParam.tokenId,
						updateParam.amount,
						updateParam.price,
						updateParam.cumulativeReward,
						updateParam.pendingReward
					)
				).to.be.revertedWith(HARDHAT_ERROR)
			})
		})
	})

	describe('setTokenURIImage', () => {
		describe('success', () => {
			it('get data', async () => {
				const [sTokensManager, sTokensManagerUser, lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await sTokensManagerUser.setTokenURIImage(1, 'ipfs://IPFS-CID')
				const tokenUri = await sTokensManager.tokenURI(1)
				checkTokenUri(
					tokenUri,
					mintParam.property,
					mintParam.amount,
					0,
					'ipfs://IPFS-CID'
				)
			})
			it('get overwritten data', async () => {
				const [, sTokensManagerUser, lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await sTokensManagerUser.setTokenURIImage(1, 'ipfs://IPFS-CID')
				await sTokensManagerUser.setTokenURIImage(1, 'ipfs://IPFS-CID2')
				const tokenUri = await sTokensManagerUser.tokenURI(1)
				checkTokenUri(
					tokenUri,
					mintParam.property,
					mintParam.amount,
					0,
					'ipfs://IPFS-CID2'
				)
			})
		})
		describe('fail', () => {
			it('not author.', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await expect(sTokensManager.setTokenURIImage(1, '')).to.be.revertedWith(
					'illegal access'
				)
			})
			it('was freezed', async () => {
				const [, sTokensManagerUser, lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await sTokensManagerUser.setTokenURIImage(1, 'http://dummy')
				await sTokensManagerUser.freezeTokenURI(1)
				await expect(
					sTokensManagerUser.setTokenURIImage(1, '')
				).to.be.revertedWith('freezed')
			})
		})
	})

	describe('freezeTokenURI', () => {
		describe('success', () => {
			it('data freezed', async () => {
				const [, sTokensManagerUser, lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await sTokensManagerUser.setTokenURIImage(1, 'http://dummy')
				let isFreezed = await sTokensManagerUser.isFreezed(1)
				expect(isFreezed).to.equal(false)
				await sTokensManagerUser.freezeTokenURI(1)
				isFreezed = await sTokensManagerUser.isFreezed(1)
				expect(isFreezed).to.equal(true)
				await expect(
					sTokensManagerUser.setTokenURIImage(1, '')
				).to.be.revertedWith('freezed')
			})
			it('generated event', async () => {
				const [, sTokensManagerUser, lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await sTokensManagerUser.setTokenURIImage(1, 'http://dummy')
				const signers = await getSigners()
				await expect(sTokensManagerUser.freezeTokenURI(1))
					.to.emit(sTokensManagerUser, 'Freezed')
					.withArgs(1, signers.user.address)
			})
		})
		describe('fail', () => {
			it('not author.', async () => {
				const [sTokensManager, sTokensManagerUser, lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await sTokensManagerUser.setTokenURIImage(1, 'http://dummy')
				await expect(sTokensManager.freezeTokenURI(1)).to.be.revertedWith(
					'illegal access'
				)
			})
			it('no uri data.', async () => {
				const [, sTokensManagerUser, lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await expect(sTokensManagerUser.freezeTokenURI(1)).to.be.revertedWith(
					'no data'
				)
			})
			it('already freezed.', async () => {
				const [, sTokensManagerUser, lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await sTokensManagerUser.setTokenURIImage(1, 'http://dummy')
				await sTokensManagerUser.freezeTokenURI(1)
				await expect(sTokensManagerUser.freezeTokenURI(1)).to.be.revertedWith(
					'already freezed'
				)
			})
		})
	})

	describe('position', () => {
		describe('success', () => {
			it('get data', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const position = await sTokensManager.positions(1)
				expect(position[0]).to.equal(mintParam.property)
				expect(position[1].toNumber()).to.equal(mintParam.amount)
				expect(position[2].toNumber()).to.equal(mintParam.price)
				expect(position[3].toNumber()).to.equal(0)
				expect(position[4].toNumber()).to.equal(0)
			})
		})
		describe('fail', () => {
			it('deta is not found', async () => {
				const [sTokensManager] = await init()
				await expect(sTokensManager.positions(12345)).to.be.revertedWith(
					HARDHAT_ERROR
				)
			})
		})
	})
	describe('rewards', () => {
		describe('success', () => {
			it('get reward', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await lockup.setCalculateWithdrawableInterestAmountByPosition(1, 100)
				const position = await sTokensManager.rewards(1)
				expect(position[0].toNumber()).to.equal(100)
				expect(position[1].toNumber()).to.equal(0)
				expect(position[2].toNumber()).to.equal(100)
			})
			it('get updated reward', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const updateParam = createUpdateParams()
				await lockup.executeUpdate(
					updateParam.tokenId,
					updateParam.amount,
					updateParam.price,
					updateParam.cumulativeReward,
					updateParam.pendingReward
				)

				await lockup.setCalculateWithdrawableInterestAmountByPosition(1, 10000)
				const position = await sTokensManager.rewards(1)
				expect(position[0].toNumber()).to.equal(10300)
				expect(position[1].toNumber()).to.equal(300)
				expect(position[2].toNumber()).to.equal(10000)
			})
		})
		describe('fail', () => {
			it('deta is not found', async () => {
				const [sTokensManager] = await init()
				await expect(sTokensManager.rewards(12345)).to.be.revertedWith(
					HARDHAT_ERROR
				)
			})
		})
	})
	describe('positionsOfProperty', () => {
		describe('success', () => {
			it('get token id', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const tokenIds = await sTokensManager.positionsOfProperty(
					mintParam.property
				)
				expect(tokenIds.length).to.equal(1)
				expect(tokenIds[0].toNumber()).to.equal(1)
			})
			it('get token by property', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const mintParam2 = await createMintParams()
				await lockup.executeMint(
					mintParam2.owner,
					mintParam2.property,
					mintParam2.amount,
					mintParam2.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const tokenIds = await sTokensManager.positionsOfProperty(
					mintParam.property
				)
				expect(tokenIds.length).to.equal(1)
				expect(tokenIds[0].toNumber()).to.equal(1)
				const tokenIds2 = await sTokensManager.positionsOfProperty(
					mintParam2.property
				)
				expect(tokenIds2.length).to.equal(1)
				expect(tokenIds2[0].toNumber()).to.equal(2)
			})
			it('get token list', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const tokenIds = await sTokensManager.positionsOfProperty(
					mintParam.property
				)
				expect(tokenIds.length).to.equal(2)
				expect(tokenIds[0].toNumber()).to.equal(1)
				expect(tokenIds[1].toNumber()).to.equal(2)
			})
			it('return empty array', async () => {
				const [sTokensManager] = await init()
				const tokenIds = await sTokensManager.positionsOfProperty(
					constants.AddressZero
				)
				expect(tokenIds.length).to.equal(0)
			})
		})
	})
	describe('positionsOfOwner', () => {
		describe('success', () => {
			it('get token id', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const tokenIds = await sTokensManager.positionsOfOwner(mintParam.owner)
				expect(tokenIds.length).to.equal(1)
				expect(tokenIds[0].toNumber()).to.equal(1)
			})
			it('get token by owners', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const mintParam2 = await createMintParams()
				await lockup.executeMint(
					mintParam2.owner,
					mintParam2.property,
					mintParam2.amount,
					mintParam2.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const tokenIds = await sTokensManager.positionsOfOwner(mintParam.owner)
				expect(tokenIds.length).to.equal(1)
				expect(tokenIds[0].toNumber()).to.equal(1)
				const tokenIds2 = await sTokensManager.positionsOfOwner(
					mintParam2.owner
				)
				expect(tokenIds2.length).to.equal(1)
				expect(tokenIds2[0].toNumber()).to.equal(2)
			})
			it('get token list', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const tokenIds = await sTokensManager.positionsOfOwner(mintParam.owner)
				expect(tokenIds.length).to.equal(2)
				expect(tokenIds[0].toNumber()).to.equal(1)
				expect(tokenIds[1].toNumber()).to.equal(2)
			})
			it('return empty array', async () => {
				const [sTokensManager] = await init()
				const tokenIds = await sTokensManager.positionsOfOwner(
					constants.AddressZero
				)
				expect(tokenIds.length).to.equal(0)
			})
			it('transfer token(index0)', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				const signers = await getSigners()
				await lockup.executeMint(
					signers.deployer.address,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await lockup.executeMint(
					signers.deployer.address,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await lockup.executeMint(
					signers.deployer.address,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await sTokensManager.transferFrom(
					signers.deployer.address,
					signers.user.address,
					1
				)
				const tokenIds = await sTokensManager.positionsOfOwner(
					signers.deployer.address
				)
				expect(tokenIds.length).to.equal(2)
				const tmpIds = tokenIds.map((value: BigNumber) => value.toNumber())
				expect(tmpIds.includes(2)).to.equal(true)
				expect(tmpIds.includes(3)).to.equal(true)

				const tokenIdsUser = await sTokensManager.positionsOfOwner(
					signers.user.address
				)
				expect(tokenIdsUser.length).to.equal(1)
				expect(tokenIdsUser[0].toNumber()).to.equal(1)
			})
			it('transfer token(index1)', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				const signers = await getSigners()
				await lockup.executeMint(
					signers.deployer.address,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await lockup.executeMint(
					signers.deployer.address,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await lockup.executeMint(
					signers.deployer.address,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await sTokensManager.transferFrom(
					signers.deployer.address,
					signers.user.address,
					2
				)
				const tokenIds = await sTokensManager.positionsOfOwner(
					signers.deployer.address
				)
				expect(tokenIds.length).to.equal(2)
				const tmpIds = tokenIds.map((value: BigNumber) => value.toNumber())
				expect(tmpIds.includes(1)).to.equal(true)
				expect(tmpIds.includes(3)).to.equal(true)

				const tokenIdsUser = await sTokensManager.positionsOfOwner(
					signers.user.address
				)
				expect(tokenIdsUser.length).to.equal(1)
				expect(tokenIdsUser[0].toNumber()).to.equal(2)
			})
			it('transfer token(index2)', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				const signers = await getSigners()
				await lockup.executeMint(
					signers.deployer.address,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await lockup.executeMint(
					signers.deployer.address,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await lockup.executeMint(
					signers.deployer.address,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)

				await sTokensManager.transferFrom(
					signers.deployer.address,
					signers.user.address,
					3
				)
				const tokenIds = await sTokensManager.positionsOfOwner(
					signers.deployer.address
				)
				expect(tokenIds.length).to.equal(2)
				const tmpIds = tokenIds.map((value: BigNumber) => value.toNumber())
				expect(tmpIds.includes(1)).to.equal(true)
				expect(tmpIds.includes(2)).to.equal(true)

				const tokenIdsUser = await sTokensManager.positionsOfOwner(
					signers.user.address
				)
				expect(tokenIdsUser.length).to.equal(1)
				expect(tokenIdsUser[0].toNumber()).to.equal(3)
			})
		})
	})
	describe('setTokenURIDescriptor', () => {
		describe('success', () => {
			it('set descriptor address', async () => {
				const [sTokensManager, sTokensManagerUser, , , tokenURIDescriptor] =
					await init()
				const mintParam = await createMintParams()
				await sTokensManagerUser.setTokenURIDescriptor(
					mintParam.property,
					tokenURIDescriptor.address
				)
				const tmp = await sTokensManager.descriptorOf(mintParam.property)
				expect(tmp).to.equal(tokenURIDescriptor.address)
			})
			it('call onBeforeMint when minting', async () => {
				const [, sTokensManagerUser, lockup, , tokenURIDescriptor] =
					await init()
				const signers = await getSigners()
				const mintParam = await createMintParams()
				await sTokensManagerUser.setTokenURIDescriptor(
					mintParam.property,
					tokenURIDescriptor.address
				)
				await lockup.executeMint(
					signers.deployer.address,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const payload = await tokenURIDescriptor.dataOf(1)
				expect(payload).to.equal(mintParam.payload)
			})
		})
		describe('fail', () => {
			it('illegal access', async () => {
				const [sTokensManager, , lockup, , tokenURIDescriptor] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await expect(
					sTokensManager.setTokenURIDescriptor(
						mintParam.property,
						tokenURIDescriptor.address
					)
				).to.be.revertedWith('illegal access')
			})
			it('revert on onBeforeMint', async () => {
				const [, sTokensManagerUser, lockup, , tokenURIDescriptor] =
					await init()
				const signers = await getSigners()
				const mintParam = await createMintParams()
				await sTokensManagerUser.setTokenURIDescriptor(
					mintParam.property,
					tokenURIDescriptor.address
				)
				await tokenURIDescriptor.__shouldBe(false)
				await expect(
					lockup.executeMint(
						signers.deployer.address,
						mintParam.property,
						mintParam.amount,
						mintParam.price,
						mintParam.payload,
						{
							gasLimit: 1200000,
						}
					)
				).to.be.revertedWith('failed to call onBeforeMint')
			})
		})
	})
	describe('currentIndex', () => {
		describe('success', () => {
			it('get initial token id number', async () => {
				const [sTokensManager, , , , , ,] = await init()
				const tmp = await sTokensManager.currentIndex()
				expect(tmp.toString()).to.equal('0')
			})
			it('get currentIndex token id number', async () => {
				const [sTokensManager, , lockup, , , ,] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const tmp = await sTokensManager.currentIndex()
				expect(tmp.toString()).to.equal('1')
			})
		})
	})
	describe('tokenURISim', () => {
		const generateParams = (): [any, any] => {
			const provider = new MockProvider()
			const property = provider.createEmptyWallet()
			const positions = {
				property: property.address,
				amount: 10,
				price: 100,
				cumulativeReward: 1000,
				pendingReward: 10000,
			}
			const reward = {
				entireReward: 100,
				cumulativeReward: 1000,
				withdrawableReward: 10000,
			}
			return [positions, reward]
		}

		it('default token uri', async () => {
			const [positions, rewards] = generateParams()
			const [sTokensManager, , , , , ,] = await init()
			const tmp = await sTokensManager.tokenURISim(
				1,
				constants.AddressZero,
				positions,
				rewards,
				ethers.constants.HashZero
			)
			checkTokenUri(
				tmp,
				positions.property,
				positions.amount,
				positions.cumulativeReward
			)
		})
		it('set token uri image', async () => {
			const [positions, rewards] = generateParams()
			const [sTokensManager, sTokensManagerUser, lockup] = await init()
			const mintParam = await createMintParams()
			await lockup.executeMint(
				mintParam.owner,
				mintParam.property,
				mintParam.amount,
				mintParam.price,
				mintParam.payload,
				{
					gasLimit: 1200000,
				}
			)
			await sTokensManagerUser.setTokenURIImage(1, 'ipfs://IPFS-CID')

			const tokenUri = await sTokensManager.tokenURISim(
				1,
				constants.AddressZero,
				positions,
				rewards,
				ethers.constants.HashZero
			)
			checkTokenUri(
				tokenUri,
				positions.property,
				positions.amount,
				positions.cumulativeReward,
				'ipfs://IPFS-CID'
			)
		})
		it('default descriptor', async () => {
			const [positions, rewards] = generateParams()
			const [sTokensManager, sTokensManagerUser, lockup, , tokenURIDescriptor] =
				await init()
			const mintParam = await createMintParams()
			positions.property = mintParam.property
			await lockup.executeMint(
				mintParam.owner,
				mintParam.property,
				mintParam.amount,
				mintParam.price,
				mintParam.payload,
				{
					gasLimit: 1200000,
				}
			)
			await sTokensManagerUser.setTokenURIDescriptor(
				mintParam.property,
				tokenURIDescriptor.address
			)
			const tmp = await sTokensManager.tokenURISim(
				1,
				constants.AddressZero,
				positions,
				rewards,
				ethers.constants.HashZero
			)
			checkTokenUri(
				tmp,
				positions.property,
				positions.amount,
				positions.cumulativeReward,
				'dummy-string'
			)
		})
	})

	describe('totalSupply', () => {
		it('initial value is 0', async () => {
			const [sTokensManager] = await init()
			const totalSupply = await sTokensManager.totalSupply()
			expect(totalSupply.toString()).to.equal('0')
		})
		it('increace totalSupply after minted', async () => {
			const [sTokensManager, , lockup] = await init()
			const mintParam = await createMintParams()
			await lockup.executeMint(
				mintParam.owner,
				mintParam.property,
				mintParam.amount,
				mintParam.price,
				mintParam.payload,
				{
					gasLimit: 1200000,
				}
			)
			const totalSupply1 = await sTokensManager.totalSupply()
			expect(totalSupply1.toString()).to.equal('1')

			await lockup.executeMint(
				mintParam.owner,
				mintParam.property,
				mintParam.amount,
				mintParam.price,
				mintParam.payload,
				{
					gasLimit: 1200000,
				}
			)
			const totalSupply2 = await sTokensManager.totalSupply()
			expect(totalSupply2.toString()).to.equal('2')
		})
	})
	describe('tokenOfOwnerByIndex', () => {
		describe('success', () => {
			it('increace tokenOfOwnerByIndex after minted', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const tokenOfOwnerByIndex1 = await sTokensManager.tokenOfOwnerByIndex(
					mintParam.owner,
					0
				)
				expect(tokenOfOwnerByIndex1.toString()).to.equal('1')

				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const tokenOfOwnerByIndex2 = await sTokensManager.tokenOfOwnerByIndex(
					mintParam.owner,
					1
				)
				expect(tokenOfOwnerByIndex2.toString()).to.equal('2')
			})
			it('[multiple persons] increace tokenOfOwnerByIndex after minted', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam1 = await createMintParams()
				await lockup.executeMint(
					mintParam1.owner,
					mintParam1.property,
					mintParam1.amount,
					mintParam1.price,
					mintParam1.payload,
					{
						gasLimit: 1200000,
					}
				)
				await lockup.executeMint(
					mintParam1.owner,
					mintParam1.property,
					mintParam1.amount,
					mintParam1.price,
					mintParam1.payload,
					{
						gasLimit: 1200000,
					}
				)
				const tokenOfOwnerByIndex1 = await sTokensManager.tokenOfOwnerByIndex(
					mintParam1.owner,
					1
				)
				expect(tokenOfOwnerByIndex1.toString()).to.equal('2')

				const mintParam2 = await createMintParams()
				await lockup.executeMint(
					mintParam2.owner,
					mintParam2.property,
					mintParam2.amount,
					mintParam2.price,
					mintParam2.payload,
					{
						gasLimit: 1200000,
					}
				)
				const tokenOfOwnerByIndex2 = await sTokensManager.tokenOfOwnerByIndex(
					mintParam2.owner,
					0
				)
				expect(tokenOfOwnerByIndex2.toString()).to.equal('3')
			})
		})
		describe('fail', () => {
			it('throws the error when the passed index is over than the holding index', async () => {
				const [sTokensManager] = await init()
				const mintParam = await createMintParams()
				await expect(
					sTokensManager.tokenOfOwnerByIndex(mintParam.owner, 0)
				).to.be.revertedWith('ERC721Enumerable: owner index out of bounds')
			})
			it('[after minted] throws the error when the passed index is over than the holding index', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await expect(
					sTokensManager.tokenOfOwnerByIndex(mintParam.owner, 1)
				).to.be.revertedWith('ERC721Enumerable: owner index out of bounds')
			})
		})
	})
	describe('tokenByIndex', () => {
		describe('success', () => {
			it('increace tokenByIndex after minted', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const tokenByIndex1 = await sTokensManager.tokenByIndex(0)
				expect(tokenByIndex1.toString()).to.equal('1')

				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const tokenByIndex2 = await sTokensManager.tokenByIndex(1)
				expect(tokenByIndex2.toString()).to.equal('2')
			})
		})
		describe('fail', () => {
			it('throws the error when the passed index is over than the minted amount', async () => {
				const [sTokensManager] = await init()
				await expect(sTokensManager.tokenByIndex(0)).to.be.revertedWith(
					'ERC721Enumerable: global index out of bounds'
				)
			})
			it('[after minted] throws the error when the passed index is over than the minted amount', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await expect(sTokensManager.tokenByIndex(1)).to.be.revertedWith(
					'ERC721Enumerable: global index out of bounds'
				)
			})
		})
	})
	describe('setSTokenRoyaltyForProperty',() => {
		describe('success', () => {
			it('set sToken royalty for property', async () => {
				const [sTokensManager, sTokensManagerUser , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const royalty = 1000
				await sTokensManagerUser.setSTokenRoyaltyForProperty(
					mintParam.property,
					royalty
				)
				expect(await sTokensManager.royaltyOf(mintParam.property)).to.equal(royalty)
			})
		})
		describe('fail', () => {
			it('not authorized', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const royalty = 1000
				await expect(
					sTokensManager.setSTokenRoyaltyForProperty(
						mintParam.property,
						royalty
					)
				).to.be.revertedWith('illegal access')
			})
			it('throws the error when the passed royalty is over than 100', async () => {
				const [, sTokensManagerUser , lockup] = await init()
				const mintParam = await createMintParams()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				await expect(
					sTokensManagerUser.setSTokenRoyaltyForProperty(
						mintParam.property,
						10001
					)
				).to.be.revertedWith('ERC2981Royalties: Too high')
			})
		})
	})
	describe('royaltyInfo', () => {
		describe('success', () => {
			it('get royalty info', async () => {
				const [sTokensManager, sTokensManagerUser , lockup] = await init()
				const mintParam = await createMintParams()
				const signers = await getSigners()
				await lockup.executeMint(
					mintParam.owner,
					mintParam.property,
					mintParam.amount,
					mintParam.price,
					mintParam.payload,
					{
						gasLimit: 1200000,
					}
				)
				const royalty = 1000
				await sTokensManagerUser.setSTokenRoyaltyForProperty(
					mintParam.property,
					royalty
				)
				const royaltyInfo = await sTokensManager.royaltyInfo(
					1,
					100
				)
				expect(royaltyInfo.receiver).to.equal(signers.user.address)
				expect(royaltyInfo.royaltyAmount.toString()).to.equal('10')
			})
		})
	})
})

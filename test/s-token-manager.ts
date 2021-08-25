/* eslint-disable prefer-destructuring */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable new-cap */
import { expect, use } from 'chai'
import { ethers } from 'hardhat'
import { Contract, constants } from 'ethers'
import { solidity } from 'ethereum-waffle'
import {
	deploy,
	deployWithArg,
	createMintParams,
	createUpdateParams,
} from './utils'
import { checkTokenUri } from './token-uri-test'

use(solidity)

describe('STokensManager', () => {
	let testData: Contract
	before(async () => {
		testData = await deploy('TestData')
	})

	const init = async (): Promise<[Contract, Contract, Contract]> => {
		const [, user] = await ethers.getSigners()
		const addressConfig = await deploy('AddressConfigTest')
		const sTokensManager = await deploy('STokensManager')
		await sTokensManager.initialize(addressConfig.address)
		const lockup = await deployWithArg('LockupTest', sTokensManager.address)
		await addressConfig.setLockup(lockup.address)
		const sTokensManagerUser = sTokensManager.connect(user)
		return [sTokensManager, sTokensManagerUser, lockup]
	}

	describe('name', () => {
		it('get token name', async () => {
			const [sTokensManager] = await init()
			const name = await sTokensManager.name()
			expect(name).to.equal('Dev Protocol sTokens V1')
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
				const mintParam = await createMintParams(testData)
				await lockup.executeMint(mintParam, {
					gasLimit: 1200000,
				})
				const filter = sTokensManager.filters.Transfer()
				const events = await sTokensManager.queryFilter(filter)
				const tokenId = events[0].args!.tokenId.toString()
				const uri = await sTokensManager.tokenURI(Number(tokenId))
				checkTokenUri(uri, mintParam.property, mintParam.amount, 0)
			})
		})
		describe('fail', () => {
			it('get token symbol', async () => {
				const [sTokensManager] = await init()
				await expect(sTokensManager.tokenURI(1)).to.be.revertedWith('not found')
			})
		})
	})
	describe('mint', () => {
		describe('success', () => {
			it('mint nft', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams(testData)
				await lockup.executeMint(mintParam, {
					gasLimit: 1200000,
				})
				const tokenId = await sTokensManager.balanceOf(mintParam.owner)
				expect(tokenId.toString()).to.equal('1')
				const owner = await sTokensManager.ownerOf(1)
				expect(owner).to.equal(mintParam.owner)
				const latestTokenId = await lockup.latestTokenId()
				expect(latestTokenId.toString()).to.equal('1')
				const latestPosition = await lockup.latestPosition()
				expect(latestPosition.owner).to.equal(mintParam.owner)
			})
			it('generate event', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams(testData)
				await lockup.executeMint(mintParam, {
					gasLimit: 1200000,
				})
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
				const mintParam = await createMintParams(testData)
				await lockup.executeMint(mintParam, {
					gasLimit: 1200000,
				})
				const filter = sTokensManager.filters.Transfer()
				const events = await sTokensManager.queryFilter(filter)
				const tokenId = events[0].args!.tokenId.toString()
				expect(tokenId).to.equal('1')
				await lockup.executeMint(mintParam, {
					gasLimit: 1200000,
				})
				const eventsSecound = await sTokensManager.queryFilter(filter)
				const tokenIdSecound = eventsSecound[1].args!.tokenId.toString()
				expect(tokenIdSecound).to.equal('2')
			})
		})
		describe('fail', () => {
			it('If the owner runs it, an error will occur.', async () => {
				const [sTokensManager] = await init()
				const mintParam = await createMintParams(testData)
				await expect(sTokensManager.mint(mintParam)).to.be.revertedWith(
					'illegal access'
				)
			})
			it('If the user runs it, an error will occur.', async () => {
				const [, sTokenManagerUser] = await init()
				const mintParam = await createMintParams(testData)
				await expect(sTokenManagerUser.mint(mintParam)).to.be.revertedWith(
					'illegal access'
				)
			})
		})
	})
	describe('update', () => {
		describe('success', () => {
			it('update data', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams(testData)
				await lockup.executeMint(mintParam, {
					gasLimit: 1200000,
				})
				const latestTokenId = await lockup.latestTokenId()
				const beforePosition = await sTokensManager.position(latestTokenId)
				expect(beforePosition.owner).to.equal(mintParam.owner)
				expect(beforePosition.property).to.equal(mintParam.property)
				expect(beforePosition.amount).to.equal(mintParam.amount)
				expect(beforePosition.price).to.equal(mintParam.price)
				expect(beforePosition.cumulativeReward).to.equal(0)
				expect(beforePosition.pendingReward).to.equal(0)
				const updateParam = await createUpdateParams(testData, latestTokenId)
				await lockup.executeUpdate(updateParam)
				const afterPosition = await lockup.latestPosition()
				expect(afterPosition.owner).to.equal(mintParam.owner)
				expect(afterPosition.property).to.equal(mintParam.property)
				expect(afterPosition.amount).to.equal(updateParam.amount)
				expect(afterPosition.price).to.equal(updateParam.price)
				expect(afterPosition.cumulativeReward).to.equal(
					updateParam.cumulativeReward
				)
				expect(afterPosition.pendingReward).to.equal(updateParam.pendingReward)
			})
		})
		describe('fail', () => {
			it('If the owner runs it, an error will occur.', async () => {
				const [sTokensManager] = await init()
				const updateParam = await createUpdateParams(testData)
				await expect(sTokensManager.update(updateParam)).to.be.revertedWith(
					'illegal access'
				)
			})
			it('If the user runs it, an error will occur.', async () => {
				const [, sTokenManagerUser] = await init()
				const updateParam = await createUpdateParams(testData)
				await expect(sTokenManagerUser.update(updateParam)).to.be.revertedWith(
					'illegal access'
				)
			})
			it('The data to be updated does not exist.', async () => {
				const [, , lockup] = await init()
				const updateParam = await createUpdateParams(testData, 193746)
				await expect(lockup.executeUpdate(updateParam)).to.be.revertedWith(
					'not found'
				)
			})
		})
	})

	describe('position', () => {
		describe('success', () => {
			it('get data', async () => {
				const [sTokensManager, , lockup] = await init()
				const mintParam = await createMintParams(testData)
				await lockup.executeMint(mintParam, {
					gasLimit: 1200000,
				})
				const position = await sTokensManager.position(1)
				expect(position.owner).to.equal(mintParam.owner)
				expect(position.property).to.equal(mintParam.property)
				expect(position.amount).to.equal(mintParam.amount)
				expect(position.price).to.equal(mintParam.price)
				expect(position.cumulativeReward).to.equal(0)
				expect(position.pendingReward).to.equal(0)
			})
		})
		describe('fail', () => {
			it('deta is not found', async () => {
				const [sTokensManager] = await init()
				await expect(sTokensManager.position(12345)).to.be.revertedWith(
					'illegal token id'
				)
			})
		})
	})
})

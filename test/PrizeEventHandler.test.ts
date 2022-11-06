import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
import { expect, assert, Assertion } from "chai"
import { ethers, getNamedAccounts } from "hardhat"
import deployContracts from "../scripts/deploy"
import { BigNumber, Signer } from "ethers"
import { PrizeEventHandler, VotingToken, TestToken } from "../typechain-types"
import { hrtime } from "process"

describe("PrizeEventHandler", function () {
    let prizeAmount: BigNumber
    let referenceBlock: BigNumber
    let daiAddress: string
    let winnersDistribution: bigint[] = []
    var voters: string[]
    var participants: string[]
    let totalSupply: string
    let prizeEventContract: PrizeEventHandler
    let voteToken: VotingToken
    let testToken: TestToken
    let minterRole: string

    beforeEach(async () => {
        // Deploy Contracts:
        const VotingToken = await ethers.getContractFactory("VotingToken")
        voteToken = await VotingToken.deploy()
        const PrizeEventHandler = await ethers.getContractFactory("PrizeEventHandler")
        prizeEventContract = await PrizeEventHandler.deploy(voteToken.address)
        await prizeEventContract.deployed()
        const TestToken = await ethers.getContractFactory("TestToken")
        totalSupply = ethers.utils.parseEther("100000").toString() //(10 ** 9).toString()
        testToken = await TestToken.deploy(totalSupply)
        await testToken.deployed()

        // Prepare values:
        prizeAmount = ethers.utils.parseEther("1")
        referenceBlock = BigNumber.from(2000000)
        daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
        winnersDistribution.push(BigInt(50))
        winnersDistribution.push(BigInt(30))
        winnersDistribution.push(BigInt(20))
        voters = []
        participants = []
        minterRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"))
    })

    describe("Event Registration", function () {
        describe("Register", function () {
            it("Should revert with insufficent allowance", async function () {
                await expect(
                    prizeEventContract.setupEvent(
                        prizeAmount,
                        referenceBlock,
                        testToken.address,
                        winnersDistribution,
                        voters,
                        participants
                    )
                ).to.be.revertedWith(`ERC20: insufficient allowance`)
            })

            it("Should revert with too many participants failed", async function () {
                const { participant1Addr } = await getNamedAccounts()
                for (let i = 0; i < 11; i++) {
                    participants[i] = participant1Addr
                }
                await expect(
                    prizeEventContract.setupEvent(
                        prizeAmount,
                        referenceBlock,
                        daiAddress,
                        winnersDistribution,
                        voters,
                        participants
                    )
                ).to.be.revertedWithCustomError(
                    prizeEventContract,
                    `PrizeEventHandler__TooManyParticipantsAtOnce`
                )
            })

            it("Should deposit token and Register Event", async function () {
                await testToken.approve(prizeEventContract.address, totalSupply)

                await prizeEventContract.setupEvent(
                    prizeAmount,
                    referenceBlock,
                    testToken.address,
                    winnersDistribution,
                    voters,
                    participants
                )

                // Assert
                // Event created:
                const prizeEvent = await prizeEventContract.getPrizeEvent(1)
                assert.equal(prizeEvent[0].toString(), "0")

                // Token Deposited:
                const balanceOfContract = await testToken.balanceOf(prizeEventContract.address)
                assert.equal(balanceOfContract.toString(), prizeAmount.toString())
            })

            it("Should emit a prize event created event", async function () {
                await testToken.approve(prizeEventContract.address, totalSupply)

                expect(
                    await prizeEventContract.setupEvent(
                        prizeAmount,
                        referenceBlock,
                        testToken.address,
                        winnersDistribution,
                        voters,
                        participants
                    )
                ).to.emit(`PrizeEventCreated(${0}, ${prizeAmount}, ${referenceBlock})`)
            })
        })
    })

    describe("Vote", function () {
        it("Should revert with not a valid event", async function () {
            const { voter1Addr, participant1Addr } = await getNamedAccounts()
            const voter1 = await ethers.getSigner(voter1Addr)
            voters.push(voter1Addr)

            // Connect with non-registered voter and vote for participant1
            await expect(
                prizeEventContract.connect(voter1).vote(1, participant1Addr, 20)
            ).to.be.revertedWithCustomError(prizeEventContract, `PrizeEventHandler__NotAValidEvent`)
        })

        it("Should revert with not a valid voter", async function () {
            const { voter1Addr, nonVoterAddr, participant1Addr } = await getNamedAccounts()
            const nonVoter = await ethers.getSigner(nonVoterAddr)
            voters.push(voter1Addr)

            await testToken.approve(prizeEventContract.address, totalSupply)
            await prizeEventContract.setupEvent(
                prizeAmount,
                referenceBlock,
                testToken.address,
                winnersDistribution,
                voters,
                participants
            )

            // Connect with non-registered voter and vote for participant1
            await expect(
                prizeEventContract.connect(nonVoter).vote(0, participant1Addr, 20)
            ).to.be.revertedWithCustomError(
                prizeEventContract,
                `PrizeEventHandler__VoterNotAllowed`
            )
        })

        it("Should revert with insufficient allowance", async function () {
            const { voter1Addr, participant1Addr } = await getNamedAccounts()
            const voter = await ethers.getSigner(voter1Addr)
            voters.push(voter1Addr)

            await testToken.approve(prizeEventContract.address, totalSupply)
            await prizeEventContract.setupEvent(
                prizeAmount,
                referenceBlock,
                testToken.address,
                winnersDistribution,
                voters,
                participants
            )

            // Connect with registered voter and vote for participant1
            await expect(
                prizeEventContract.connect(voter).vote(0, participant1Addr, 20)
            ).to.be.revertedWith(`ERC20: insufficient allowance`)
        })

        it("Should successfully vote", async function () {
            const { voter1Addr, participant1Addr } = await getNamedAccounts()
            const voter1 = await ethers.getSigner(voter1Addr)
            voters.push(voter1Addr)

            await testToken.approve(prizeEventContract.address, totalSupply)
            await prizeEventContract.setupEvent(
                prizeAmount,
                referenceBlock,
                testToken.address,
                winnersDistribution,
                voters,
                participants
            )

            // mint some vote tokens:
            const voteAmount = ethers.utils.parseEther("20")
            await voteToken.grantRole(minterRole, voter1Addr)
            await voteToken.connect(voter1).mint(voter1Addr, voteAmount)
            await voteToken.connect(voter1).approve(prizeEventContract.address, voteAmount)
            // Connect with registered voter and vote for participant1
            await prizeEventContract.connect(voter1).vote(0, participant1Addr, voteAmount)

            // Validate vote token balance has been transfered to contract & participant1 votes are registered
            assert.equal((await voteToken.balanceOf(voter1Addr)).toString(), "0")
            assert.equal(
                (await voteToken.balanceOf(prizeEventContract.address)).toString(),
                voteAmount.toString()
            )
            assert.equal(
                await (
                    await prizeEventContract.getVotesForParticipantInEvent(0, participant1Addr)
                ).toString(),
                voteAmount.toString()
            )
        })
    })
    describe("Close Event", function () {
        it("Should revert with insufficient allowance", async function () {
            const { voter1Addr, participant1Addr } = await getNamedAccounts()
            const voter = await ethers.getSigner(voter1Addr)
            voters.push(voter1Addr)

            await testToken.approve(prizeEventContract.address, totalSupply)
            await prizeEventContract.setupEvent(
                prizeAmount,
                referenceBlock,
                testToken.address,
                winnersDistribution,
                voters,
                participants
            )

            // Connect with registered voter and vote for participant1
            await expect(
                prizeEventContract.connect(voter).vote(0, participant1Addr, 20)
            ).to.be.revertedWith(`ERC20: insufficient allowance`)
        })
    })
    // TODO: Do this on UPDATE methods:
    // it("Should revert with only owner of event", async function () {
    //     const { voter1Addr, nonVoterAddr, participant1Addr } = await getNamedAccounts()
    //     const nonVoter = await ethers.getSigner(nonVoterAddr)
    //     voters.push(voter1Addr)

    //     await testToken.approve(prizeEventContract.address, totalSupply)
    //     await prizeEventContract.setupEvent(
    //         prizeAmount,
    //         referenceBlock,
    //         testToken.address,
    //         winnersDistribution,
    //         voters,
    //         participants
    //     )

    //     // Connect with non-registered voter and vote for participant1
    //     await expect(
    //         prizeEventContract.connect(nonVoter).vote(0, participant1Addr, 20)
    //     ).to.be.revertedWithCustomError(
    //         prizeEventContract,
    //         `PrizeEventHandler__OnlyOwnerOfEventAllowed`
    //     )
    // })
})

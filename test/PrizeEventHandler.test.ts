import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
import { expect, assert, Assertion } from "chai"
import { ethers, getNamedAccounts } from "hardhat"
import deployContracts from "../scripts/deploy"
import { BigNumber, Signer } from "ethers"
import { PrizeEventHandler, VotingToken } from "../typechain-types"
import { hrtime } from "process"

describe("PrizeEventHandler", function () {
    let prizeAmount: BigNumber
    let referenceBlock: BigNumber
    let winnersDistribution: bigint[] = []
    var voters: string[]
    var participants: string[]
    let totalSupply: string
    let prizeEventContract: PrizeEventHandler
    let votingToken: VotingToken
    let minterRole: string

    beforeEach(async () => {
        totalSupply = ethers.utils.parseEther("100000").toString() //(10 ** 9).toString()

        // Deploy Contracts:
        const VotingToken = await ethers.getContractFactory("VotingToken")
        votingToken = await VotingToken.deploy()
        await votingToken.deployed()

        const PrizeEventHandler = await ethers.getContractFactory("PrizeEventHandler")
        prizeEventContract = await PrizeEventHandler.deploy(votingToken.address)
        await prizeEventContract.deployed()

        // Prepare values:
        prizeAmount = ethers.utils.parseEther("1")
        referenceBlock = BigNumber.from(2000000)
        winnersDistribution.push(BigInt(50))
        winnersDistribution.push(BigInt(30))
        winnersDistribution.push(BigInt(20))
        voters = []
        participants = []
        minterRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"))
    })

    describe("Event Registration", function () {
        describe("Register", function () {
            it("Should revert with too many participants failed", async function () {
                const { participant1Addr } = await getNamedAccounts()
                for (let i = 0; i < 11; i++) {
                    participants[i] = participant1Addr
                }
                await expect(
                    prizeEventContract.setupEvent(
                        prizeAmount,
                        referenceBlock,
                        winnersDistribution,
                        voters,
                        participants
                    )
                ).to.be.revertedWithCustomError(
                    prizeEventContract,
                    `PrizeEventHandler__TooManyParticipantsAtOnce`
                )
            })

            it("Should emit a prize event created event", async function () {
                await votingToken.approve(prizeEventContract.address, totalSupply)

                expect(
                    await prizeEventContract.setupEvent(
                        prizeAmount,
                        referenceBlock,
                        winnersDistribution,
                        voters,
                        participants
                    )
                ).to.emit(
                    prizeEventContract,
                    `PrizeEventCreated(${0}, ${prizeAmount}, ${referenceBlock})`
                )
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

            await votingToken.approve(prizeEventContract.address, totalSupply)
            await prizeEventContract.setupEvent(
                prizeAmount,
                referenceBlock,
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

            await votingToken.approve(prizeEventContract.address, totalSupply)
            await prizeEventContract.setupEvent(
                prizeAmount,
                referenceBlock,
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

            await votingToken.approve(prizeEventContract.address, totalSupply)
            await prizeEventContract.setupEvent(
                prizeAmount,
                referenceBlock,
                winnersDistribution,
                voters,
                participants
            )

            // mint some vote tokens:
            const voteAmount = ethers.utils.parseEther("20")
            await votingToken.grantRole(minterRole, voter1Addr)
            await votingToken.connect(voter1).mint(voter1Addr, voteAmount)
            await votingToken.connect(voter1).approve(prizeEventContract.address, voteAmount)
            // Connect with registered voter and vote for participant1
            await prizeEventContract.connect(voter1).vote(0, participant1Addr, voteAmount)

            // Validate vote token balance has been transfered to contract & participant1 votes are registered
            assert.equal((await votingToken.balanceOf(voter1Addr)).toString(), "0")
            assert.equal(
                (await votingToken.balanceOf(prizeEventContract.address)).toString(),
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

            await votingToken.approve(prizeEventContract.address, totalSupply)
            await prizeEventContract.setupEvent(
                prizeAmount,
                referenceBlock,
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

    //     await votingToken.approve(prizeEventContract.address, totalSupply)
    //     await prizeEventContract.setupEvent(
    //         prizeAmount,
    //         referenceBlock,
    //         votingToken.address,
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

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
import { expect, assert, Assertion } from "chai"
import { ethers, getNamedAccounts } from "hardhat"
import deployContracts from "../scripts/deploy"
import { BigNumber, Signer } from "ethers"
import { PrizeEventHandler, VotingToken } from "../typechain-types"
import { hrtime } from "process"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

describe("PrizeEventHandler", function () {
    let prizeAmount: BigNumber
    let referenceBlock: BigNumber
    let winnersDistribution: bigint[] = []
    var voters: string[]
    var participants: string[]
    let prizeEventContract: PrizeEventHandler
    let votingToken: VotingToken
    let minterRole: string
    let burnerRole: string
    let owner: SignerWithAddress, addr1: SignerWithAddress

    const amountToBeSent = ethers.utils.parseEther("1")
    const votingTokenPrice = ethers.utils.parseEther("0.01")

    beforeEach(async () => {
        ;[owner, addr1] = await ethers.getSigners()

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
        participants = [owner.address, addr1.address]
        minterRole = await votingToken.MINTER_ROLE()
        burnerRole = await votingToken.BURNER_ROLE()

        await votingToken.grantRole(minterRole, prizeEventContract.address)
        await votingToken.grantRole(burnerRole, prizeEventContract.address)
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
        it("should allow users to purchase voting tokens", async function () {
            const purchaseTokensTx = await prizeEventContract.connect(addr1).purchaseVotingToken({
                value: amountToBeSent,
            })
            await purchaseTokensTx.wait()

            const balance = await votingToken.balanceOf(addr1.address)

            expect(balance).to.equal(Number(amountToBeSent) / Number(votingTokenPrice))
        })

        it("Should successfully vote", async function () {
            const purchaseTokensTx = await prizeEventContract.connect(addr1).purchaseVotingToken({
                value: amountToBeSent,
            })
            await purchaseTokensTx.wait()

            await prizeEventContract.setupEvent(
                prizeAmount,
                referenceBlock,
                winnersDistribution,
                voters,
                participants
            )

            const balance = await votingToken.balanceOf(addr1.address)

            // Connect with registered voter and vote for participant1
            await prizeEventContract.connect(addr1).vote(0, participants[0], balance)

            expect(
                await (
                    await prizeEventContract.getVotesForParticipantInEvent(0, participants[0])
                ).toString()
            ).to.equal(balance.toString())
        })

        it("Should burn voter voting tokens as votes can only be used once", async function () {
            const purchaseTokensTx = await prizeEventContract.connect(addr1).purchaseVotingToken({
                value: amountToBeSent,
            })
            await purchaseTokensTx.wait()

            await prizeEventContract.setupEvent(
                prizeAmount,
                referenceBlock,
                winnersDistribution,
                voters,
                participants
            )

            const balance = await votingToken.balanceOf(addr1.address)

            await prizeEventContract.connect(addr1).vote(0, participants[0], balance)

            expect(await votingToken.balanceOf(addr1.address)).to.equal(0)
        })

        it("Should revert with not a valid event", async function () {
            const { voter1Addr, participant1Addr } = await getNamedAccounts()
            const voter1 = await ethers.getSigner(voter1Addr)
            voters.push(voter1Addr)

            // Connect with non-registered voter and vote for participant1
            await expect(
                prizeEventContract.connect(voter1).vote(1, participant1Addr, 20)
            ).to.be.revertedWithCustomError(prizeEventContract, `PrizeEventHandler__NotAValidEvent`)
        })

        // it("Should revert with insufficient allowance", async function () {
        //     const { voter1Addr, participant1Addr } = await getNamedAccounts()
        //     const voter = await ethers.getSigner(voter1Addr)
        //     voters.push(voter1Addr)

        //     await prizeEventContract.setupEvent(
        //         prizeAmount,
        //         referenceBlock,
        //         winnersDistribution,
        //         voters,
        //         participants
        //     )

        //     // Connect with registered voter and vote for participant1
        //     await expect(
        //         prizeEventContract.connect(voter).vote(0, participant1Addr, 20)
        //     ).to.be.revertedWith(`ERC20: insufficient allowance`)
        // })
    })
    describe("Close Event", function () {
        // it("Should revert with insufficient allowance", async function () {
        //     const { voter1Addr, participant1Addr } = await getNamedAccounts()
        //     const voter = await ethers.getSigner(voter1Addr)
        //     voters.push(voter1Addr)
        //     await prizeEventContract.setupEvent(
        //         prizeAmount,
        //         referenceBlock,
        //         winnersDistribution,
        //         voters,
        //         participants
        //     )
        //     // Connect with registered voter and vote for participant1
        //     await expect(
        //         prizeEventContract.connect(voter).vote(0, participant1Addr, 20)
        //     ).to.be.revertedWith(`ERC20: insufficient allowance`)
        // })
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

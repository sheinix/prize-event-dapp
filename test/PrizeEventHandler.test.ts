import { expect, assert } from "chai"
import { ethers, getNamedAccounts } from "hardhat"
import { BigNumber } from "ethers"
import { PrizeEventHandler, VotingToken, TestToken } from "../typechain-types"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

describe("PrizeEventHandler", function () {
    let prizeAmount: BigNumber
    let referenceBlock: BigNumber
    let winnersDistribution: bigint[] = []
    var voters: string[]
    var participants: string[]
    let totalSupply: string
    let prizeEventContract: PrizeEventHandler
    let voteToken: VotingToken
    let testToken: TestToken
    let minterRole: string
    let owner: SignerWithAddress, addr1: SignerWithAddress
    const amountToBeSent = ethers.utils.parseEther("1")
    const votingTokenPrice = ethers.utils.parseEther("0.01")

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
        winnersDistribution = [BigInt(50), BigInt(30), BigInt(20)]
        voters = []
        participants = []
        minterRole = await voteToken.MINTER_ROLE()
        await voteToken.grantRole(minterRole, prizeEventContract.address)
        ;[owner, addr1] = await ethers.getSigners()
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
                        testToken.address,
                        winnersDistribution,
                        voters,
                        participants
                    )
                ).to.be.revertedWithCustomError(
                    prizeEventContract,
                    `PrizeEventHandler__TooManyParticipantsAtOnce`
                )
            })

            it("Should Revert with invalid distribution array - not 100%", async function () {
                await testToken.approve(prizeEventContract.address, totalSupply)
                const invalidWinnersDist = [BigInt(50), BigInt(70)]
                await expect(
                    prizeEventContract.setupEvent(
                        prizeAmount,
                        referenceBlock,
                        testToken.address,
                        invalidWinnersDist,
                        voters,
                        participants
                    )
                ).to.be.revertedWithCustomError(
                    prizeEventContract,
                    `PrizeEventHandler__InvalidWinnerDistribution`
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
                console.log(`balance of contract: ${balanceOfContract}`)
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
            participants.push(participant1Addr)

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

        it("should allow users to purchase voting tokens", async function () {
            const purchaseTokensTx = await prizeEventContract.connect(addr1).purchaseVotingToken({
                value: amountToBeSent,
            })
            await purchaseTokensTx.wait()

            const balance = await voteToken.balanceOf(addr1.address)

            expect(balance).to.equal(Number(amountToBeSent) / Number(votingTokenPrice))
        })

        it("Should revert with Not valid participant", async function () {
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
            ).to.be.revertedWithCustomError(
                prizeEventContract,
                `PrizeEventHandler__NotValidParticipantForEvent`
            )
        })

        it("Should successfully vote", async function () {
            const { voter1Addr, participant1Addr } = await getNamedAccounts()
            const voter1 = await ethers.getSigner(voter1Addr)
            voters.push(voter1Addr)
            participants.push(participant1Addr)

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

    describe("Close Event & Claim Prize", function () {
        // This BeforeEach block setups the event with voters/participants & does the voting
        beforeEach(async () => {
            const {
                voter1Addr,
                voter2Addr,
                voter3Addr,
                participant1Addr,
                participant2Addr,
                participant4Addr,
            } = await getNamedAccounts()

            // Set Voters & Participants:
            const voter1 = await ethers.getSigner(voter1Addr)
            const voter2 = await ethers.getSigner(voter2Addr)
            const voter3 = await ethers.getSigner(voter3Addr)

            voters.push(voter1Addr)
            voters.push(voter2Addr)
            voters.push(voter3Addr)
            participants.push(participant1Addr)
            participants.push(participant2Addr)
            participants.push(participant4Addr)

            // Approve prize token (testToken) & setup event:
            await testToken.approve(prizeEventContract.address, totalSupply)
            await prizeEventContract.setupEvent(
                prizeAmount,
                referenceBlock,
                testToken.address,
                winnersDistribution,
                voters,
                participants
            )

            // mint vote tokens & vote:
            const voteAmountForWinner = ethers.utils.parseEther("50")
            const voteAmount = ethers.utils.parseEther("10")
            await voteToken.grantRole(minterRole, voter1Addr)
            await voteToken.connect(voter1).mint(voter1Addr, voteAmountForWinner)
            await voteToken.connect(voter1).approve(prizeEventContract.address, voteAmountForWinner)

            await voteToken.grantRole(minterRole, voter2Addr)
            await voteToken.connect(voter2).mint(voter2Addr, voteAmount)
            await voteToken.connect(voter2).approve(prizeEventContract.address, voteAmount)

            await voteToken.grantRole(minterRole, voter3Addr)
            await voteToken.connect(voter3).mint(voter3Addr, voteAmount)
            await voteToken.connect(voter3).approve(prizeEventContract.address, voteAmount)

            // 3 participants: vote for participant1 to win but have 3 contestants
            await prizeEventContract.connect(voter1).vote(0, participant1Addr, voteAmountForWinner)
            await prizeEventContract.connect(voter2).vote(0, participant2Addr, voteAmount)
            await prizeEventContract.connect(voter3).vote(0, participant2Addr, voteAmount.div(2))
            await prizeEventContract.connect(voter3).vote(0, participant4Addr, voteAmount.div(2))
        })

        it("should revert with invalid event", async () => {
            await expect(prizeEventContract.closeEvent(1)).to.be.revertedWithCustomError(
                prizeEventContract,
                `PrizeEventHandler__NotAValidEvent`
            )
        })

        it("should revert with only owner of event", async () => {
            const { voter1Addr, participant1Addr } = await getNamedAccounts()
            const voter1 = await ethers.getSigner(voter1Addr)
            await expect(
                prizeEventContract.connect(voter1).closeEvent(0)
            ).to.be.revertedWithCustomError(
                prizeEventContract,
                `PrizeEventHandler__OnlyOwnerOfEventAllowed`
            )
        })

        it("should revert with invalid event", async () => {
            await expect(prizeEventContract.closeEvent(1)).to.be.revertedWithCustomError(
                prizeEventContract,
                `PrizeEventHandler__NotAValidEvent`
            )
        })

        it("should revert with only open events ", async () => {
            await prizeEventContract.closeEvent(0)
            await expect(prizeEventContract.closeEvent(0)).to.be.revertedWithCustomError(
                prizeEventContract,
                `PrizeEventHandler__EventClosed`
            )
        })

        it("Should close the event and distribute prizes", async function () {
            const { participant1Addr, participant2Addr, participant4Addr } =
                await getNamedAccounts()

            // Close the Event:
            await prizeEventContract.closeEvent(0)

            // Get status of votes & participants:
            const participant1Votes = await prizeEventContract.getVotesForParticipantInEvent(
                0,
                participant1Addr
            )
            const participant2Votes = await prizeEventContract.getVotesForParticipantInEvent(
                0,
                participant2Addr
            )
            const participant4Votes = await prizeEventContract.getVotesForParticipantInEvent(
                0,
                participant4Addr
            )
            const balanceInTokenForWinner = await prizeEventContract.getParticipantBalanceIn(
                participant1Addr,
                testToken.address
            )

            const balanceInTokenFor2nd = await prizeEventContract.getParticipantBalanceIn(
                participant2Addr,
                testToken.address
            )

            const balanceInTokenFor3rd = await prizeEventContract.getParticipantBalanceIn(
                participant4Addr,
                testToken.address
            )

            // Get the event & assert:
            const prizeEvent = await prizeEventContract.getPrizeEvent(0)
            const voteAmountForWinner = ethers.utils.parseEther("50")
            assert.equal(prizeEvent[8].toString(), "1")
            assert.equal(participant1Votes.toString(), voteAmountForWinner.toString())
            assert.equal(balanceInTokenForWinner.toString(), prizeAmount.div(2).toString()) // the 1st place was 50% of prize
            assert.equal(balanceInTokenFor2nd.toString(), prizeAmount.div(100).mul(30).toString()) // the 2nd place was 30% of prize
            assert.equal(balanceInTokenFor3rd.toString(), prizeAmount.div(100).mul(20).toString()) // the 3rd place was 20% of prize
        })

        it("The winners should claim the prize correctly", async function () {
            const { participant1Addr, participant2Addr, participant4Addr, deployer } =
                await getNamedAccounts()
            const participant1 = await ethers.getSigner(participant1Addr)
            const participant2 = await ethers.getSigner(participant2Addr)
            const participant4 = await ethers.getSigner(participant4Addr)

            // Close the Event:
            await prizeEventContract.closeEvent(0)

            const balanceOfContract = await testToken.balanceOf(prizeEventContract.address)
            const balanceInTokenForWinner = await prizeEventContract.getParticipantBalanceIn(
                participant1Addr,
                testToken.address
            )
            const balanceInTokenFor2nd = await prizeEventContract.getParticipantBalanceIn(
                participant2Addr,
                testToken.address
            )

            const balanceInTokenFor3rd = await prizeEventContract.getParticipantBalanceIn(
                participant4Addr,
                testToken.address
            )

            const totalPrize = balanceInTokenForWinner
                .add(balanceInTokenFor2nd)
                .add(balanceInTokenFor3rd)
            assert.equal(totalPrize.toString(), prizeAmount.toString())
            assert.equal(totalPrize.toString(), balanceOfContract.toString())

            // Claim Prizes:
            await prizeEventContract.connect(participant1).claimPrizeIn(testToken.address)
            await prizeEventContract.connect(participant2).claimPrizeIn(testToken.address)
            await prizeEventContract.connect(participant4).claimPrizeIn(testToken.address)

            // Get balance in prize token for the winners:
            const participant1Balance = await testToken.balanceOf(participant1Addr)
            const participant2Balance = await testToken.balanceOf(participant2Addr)
            const participant4Balance = await testToken.balanceOf(participant4Addr)
            const addressBalance = await testToken.balanceOf(prizeEventContract.address)

            // Assert they have the correct amount:
            assert.equal(participant1Balance.toString(), prizeAmount.div(2).toString()) // the 1st place was 50% of prize
            assert.equal(participant2Balance.toString(), prizeAmount.div(100).mul(30).toString()) // the 1st place was 50% of prize
            assert.equal(participant4Balance.toString(), prizeAmount.div(100).mul(20).toString()) // the 1st place was 50% of prize
            assert.equal(addressBalance.toString(), "0")
        })
    })
})

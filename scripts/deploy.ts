import { ethers } from "hardhat"

async function deployContracts() {
    console.log("Deploying Voting Token First...")

    const VotingToken = await ethers.getContractFactory("VotingToken")

    const voteToken = await VotingToken.deploy()

    await voteToken.deployed()

    console.log(`Voting Token deployed to address: ${voteToken.address}`)

    console.log("Deploying Prize Event Handler now...")

    const PrizeEventHandler = await ethers.getContractFactory("PrizeEventHandler")

    const prizeEventContract = await PrizeEventHandler.deploy(voteToken.address)
    await prizeEventContract.deployed()

    console.log(`PrizeEventHandler deployed to address: ${prizeEventContract.address}`)
}

export default deployContracts
deployContracts.tags = ["all"]

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployContracts().catch((error) => {
    console.error(error)
    process.exitCode = 1
})

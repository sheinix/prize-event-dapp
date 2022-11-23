import { ethers } from "hardhat"
import { VotingToken } from "../typechain-types"
import { verify } from "./verify"

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

    if (ethers.provider.network.chainId == 5) {
        console.log(`Verifying Vote Token....`)
        await verify(voteToken.address, [])

        const minterRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"))
        await voteToken.grantRole(minterRole, prizeEventContract.address)

        console.log(`Verifying PrizeEventHandler....`)
        await verify(prizeEventContract.address, voteToken.address)
    }

    return { voteToken, prizeEventContract }
}

export default deployContracts
deployContracts.tags = ["all"]

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployContracts().catch((error) => {
    console.error(error)
    process.exitCode = 1
})

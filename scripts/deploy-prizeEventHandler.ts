import { ethers } from "hardhat"
import { VotingToken } from "../typechain-types"
import { verify } from "./verify"

async function deployContracts() {
    const votingTokenAddr = "0x14216589C62A80e4a165ACE4C9bdB50EdFa4243c"
    console.log("Deploying Prize Event Handler Only...")

    const PrizeEventHandler = await ethers.getContractFactory("PrizeEventHandler")

    const prizeEventContract = await PrizeEventHandler.deploy(votingTokenAddr)
    await prizeEventContract.deployed()

    console.log(`PrizeEventHandler deployed to address: ${prizeEventContract.address}`)

    if (ethers.provider.network.chainId == 5) {
        const minterRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"))
        const voteToken = await ethers.getContractAt("VotingToken", votingTokenAddr)
        await voteToken.grantRole(minterRole, prizeEventContract.address)

        console.log(`Verifying PrizeEventHandler....`)
        await verify(prizeEventContract.address, `"${votingTokenAddr}"`)
    }

    return { prizeEventContract }
}

export default deployContracts
deployContracts.tags = ["prizeEventContract"]

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployContracts().catch((error) => {
    console.error(error)
    process.exitCode = 1
})

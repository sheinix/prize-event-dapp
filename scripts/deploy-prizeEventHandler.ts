import { ethers, getNamedAccounts } from "hardhat"
import { VotingToken } from "../typechain-types"
import { verify } from "./verify"

async function deployContracts() {
    const votingTokenAddr = "0x14216589C62A80e4a165ACE4C9bdB50EdFa4243c"
    const { deployer } = await getNamedAccounts()
    const deployerAcct = await ethers.getSigner(deployer)
    const LINK_GOERLI_TOKEN_ADDR = "0x326C977E6efc84E512bB9C30f76E30c160eD06FB"

    console.log("Deploying Prize Event Handler Only...")

    const PrizeEventHandler = await ethers.getContractFactory("PrizeEventHandler")

    const prizeEventContract = await PrizeEventHandler.deploy(votingTokenAddr)
    await prizeEventContract.deployed()

    console.log(`PrizeEventHandler deployed to address: ${prizeEventContract.address}`)

    if (ethers.provider.network.chainId == 5) {
        // Get The Deployed Vote ERC20:
        const voteToken = await ethers.getContractAt("VotingToken", votingTokenAddr, deployerAcct)

        // Grant Mint role to the contract:
        const minterRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"))
        await voteToken.grantRole(minterRole, prizeEventContract.address)

        // Approve vote token to contract
        const totalSupply = await voteToken.totalSupply()
        await voteToken.approve(prizeEventContract.address, totalSupply)

        console.log(`Verifying PrizeEventHandler....`)
        await verify(prizeEventContract.address, [votingTokenAddr])
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

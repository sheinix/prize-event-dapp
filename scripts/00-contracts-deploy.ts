import { ethers } from "hardhat"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import * as deploy from "hardhat-deploy"

const contractDeployer: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    console.log("Deploying Voting Token First...")

    const voteToken = await deploy("VotingToken", { from: deployer, args: [], log: true })

    console.log(`Voting Token deployed to address: ${voteToken.address}`)

    console.log("Deploying Prize Event Handler now...")

    // const PrizeEventHandler = await ethers.getContractFactory("PrizeEventHandler")
    // const prizeEventContract = await PrizeEventHandler.deploy(voteToken.address)
    // await prizeEventContract.deployed()

    const prizeEventContract = await deploy("PrizeEventHandler", {
        from: deployer,
        args: [voteToken.address],
        log: true,
    })
    // await prizeEventContract.deployed()
    console.log(`PrizeEventHandler deployed to address: ${prizeEventContract.address}`)
}

export default contractDeployer
contractDeployer.tags = ["all"]

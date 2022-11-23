import { utils, Wallet } from "zksync-web3"
import * as ethers from "ethers"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { Deployer } from "@matterlabs/hardhat-zksync-deploy"

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
    console.log(`Running deploy script for the Prize Event contract`)

    // Initialize the wallet.
    const wallet = new Wallet(process.env.PRIVATE_KEY)

    // Create deployer object and load the artifact of the contract we want to deploy.
    const deployer = new Deployer(hre, wallet)
    const artifact = await deployer.loadArtifact("VotingToken")

    // Deposit some funds to L2 in order to be able to perform L2 transactions.
    const depositAmount = ethers.utils.parseEther("0.001")
    const depositHandle = await deployer.zkWallet.deposit({
        to: deployer.zkWallet.address,
        token: utils.ETH_ADDRESS,
        amount: depositAmount,
    })
    // Wait until the deposit is processed on zkSync
    await depositHandle.wait()

    // Deploy this contract. The returned object will be of a `Contract` type, similarly to ones in `ethers`.
    // `greeting` is an argument for contract constructor.
    const voteToken = await deployer.deploy(artifact, [])

    // Show the contract info.
    const voteContractAddress = voteToken.address
    console.log(`${artifact.contractName} was deployed to ${voteContractAddress}`)

    // Call the deployed contract.
    const totalSupply = await voteToken.totalSupply()
    console.log(`Total supply of Vote Token: ${totalSupply}!`)
}

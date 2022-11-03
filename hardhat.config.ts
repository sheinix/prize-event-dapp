import { HardhatUserConfig } from "hardhat/config"
import "@typechain/hardhat"
import "@nomiclabs/hardhat-ethers"
import "@nomicfoundation/hardhat-toolbox"
import "hardhat-deploy"

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.17",
    },
    namedAccounts: {
        deployer: 0,
        sponsor: 1,
        voter1: 2,
        voter2: 3,
        voter3: 4,
        participant1: 5,
        participant2: 6,
        participant3: 7,
        nonParticipant: 8,
        nonVoter: 9,
    },
}

export default config

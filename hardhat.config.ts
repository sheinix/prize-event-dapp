import { HardhatUserConfig } from "hardhat/config"
import "@typechain/hardhat"
import "@nomiclabs/hardhat-ethers"
import "@nomicfoundation/hardhat-toolbox"
import "hardhat-deploy"

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.8.17",
            },
            {
                version: "0.8.4",
            },
        ],
    },
    namedAccounts: {
        deployer: 0,
        sponsor: 1,
        voter1Addr: 2,
        voter2Addr: 3,
        voter3Addr: 4,
        participant1Addr: 5,
        participant2Addr: 6,
        participant3Addr: 7,
        participant4Addr: 8,
        nonVoterAddr: 9,
    },
}

export default config

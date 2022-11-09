import { HardhatUserConfig } from "hardhat/config"
import "@typechain/hardhat"
import "@nomiclabs/hardhat-ethers"
import "@nomicfoundation/hardhat-toolbox"
import "hardhat-deploy"
import dotenv from "dotenv"

dotenv.config()

const { ETHERSCAN_API_KEY, REPORT_GAS, COINMARKETCAP_API_KEY, GOERLI_RPC_URL, PRIVATE_KEY } =
    process.env

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
    etherscan: {
        // npx hardhat verify --network <NETWORK> <CONTRACT_ADDRESS> <CONSTRUCTOR_PARAMETERS>
        apiKey: {
            goerli: ETHERSCAN_API_KEY,
        },
    },
    gasReporter: {
        enabled: REPORT_GAS,
        currency: "USD",
        token: "MATIC",
        outputFile: "gas-report.txt",
        noColors: true,
        coinmarketcap: COINMARKETCAP_API_KEY,
        gasPriceApi: "https://api.polygonscan.com/api?module=proxy&action=eth_gasPrice",
    },
    networks: {
        hardhat: {
            // // If you want to do some forking, uncomment this
            // forking: {
            //   url: MAINNET_RPC_URL
            // }
            chainId: 31337,
        },
        localhost: {
            chainId: 31337,
        },
        goerli: {
            url: GOERLI_RPC_URL,
            accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
            saveDeployments: true,
            chainId: 5,
        },
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

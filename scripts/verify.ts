import { run } from "hardhat"

const verify = async (contractAddress: string, args: []) => {
    console.log("Verifying contract...")
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        })
    } catch (e) {
        console.log(e)
    }
}
export default verify

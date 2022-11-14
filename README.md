# Prize Event Dapp 💰

Prize Event Dapp is a Smart Contract written in Soilidity for anyone to run their own descentalised prize money contest. One of the main use cases is run your own Hackthons with sponsors.

### Prize Event Contract
Handles the creation of an event, the voting & the distribution of the prize to the winners.
Currently deployed in Goerli at: `0xdCC94d087a9b5fbbf64d31254771d3880DdED4eC`

### Voting Token
Simple ERC-20 used for voting in the Prize Event Contract. You can buy voting tokens from Prize Event Contract directly.
Currently deployed in Goerli at: `0x14216589C62A80e4a165ACE4C9bdB50EdFa4243c`


## Usage

**1. Setup a Prize Event (contest) with:**
   - Amount of ERC-20 Prize Token
   - Address of the ERC-20 token that is going to be used as prize (e.g. DAI, USDC, LINK,etc.)
   - The Winners distribution array: The % of the prize that each winner can claim, e.g.: 
       - 1st) 50% of pot prize
       - 2nd) 30% of pot prize
       - 3rd) 20% of pot prize
   - The List of Addresses that are going to be allowed as voters in the event
   - The List of Addresses acting as participants of the event (later anyone can register as participant)

**2. Vote for a participant.**
   - You will need:
      - Have voting token in your wallet (can be bought from contract with ETH)
      - The Event ID (Emitted on event creation)
      - The participant address

**3. Close Event.**
   - Once voting is ready, the owner (creator) of the event can close it
   - The closing of event, will choose the winners and distribute the balance of the token prize to their balances.

**4. Claim Prize**
   - As a winner, you can claim the prize from the smart contract by providing the address of the token that you want to claim.

## Installation

Use yarn package manager to install dependencies.

```bash
yarn install
```

## Flow
![Flow](https://pdfhost.io/v/15m7GPZuA_Flowcharts)

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)
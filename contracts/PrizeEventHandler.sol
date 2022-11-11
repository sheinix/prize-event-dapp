// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./VotingToken.sol";

error PrizeEventHandler__TooManyParticipantsAtOnce();
error PrizeEventHandler__ApprovalFailed(address token, uint256 amount);
error PrizeEventHandler__RegistrationFailed(address token, uint256 amount);
error PrizeEventHandler__NotAValidEvent(uint256 eventId);
error PrizeEventHandler__VoterNotAllowed(uint256 eventId, address voter);
error PrizeEventHandler__OnlyOwnerOfEventAllowed();
error PrizeEventHandler__VotingFailed(uint256 eventId, address participant, uint256 amountVotes);
error PrizeEventHandler__EventClosed(uint256 eventId);
error PrizeEventHandler__ParticipantAlreadyRegistered(uint256 eventId, address participant);
error PrizeEventHandler__NotValidParticipantForEvent(address participant, uint256 eventId);
error PrizeEventHandler__InvalidPrizeClaim(address participant, address tokenPrize);
error PrizeEventHandler__InvalidWinnerDistribution(uint256[] winnerDistribution);

contract PrizeEventHandler is AccessControl {
    using Counters for Counters.Counter;
    using SafeMath for uint256;

    enum EventStatus {
        OPEN,
        CLOSED
    }

    struct PrizeEvent {
        uint256 eventId;
        address owner;
        uint256 prizeAmount;
        uint256 referenceBlock;
        IERC20 prizeToken;
        // @notice Array of numbers that reprsesents the distribution of price ([50%, 30%, 20%] or [100%] or [40%, 30%, 20%, 10%] etc.)
        uint256[] winnersDistribution;
        address[] voters;
        address[] participants;
        EventStatus status;
    }

    // Events:
    event PrizeEventCreated(
        uint256 indexed eventId,
        uint256 indexed prizeAmount,
        uint256 indexed referenceBlock
    );

    event PrizeEventClosed(uint256 indexed eventId, uint256 indexed prizeAmount);

    //@notice the array of prize events created
    PrizeEvent[] public s_eventsArray;

    // @notice the eventId -> PrizeEvent mapping
    mapping(uint256 => PrizeEvent) public s_prizeEvents;

    // @notice the nested mapping:
    // participant Address -> mapp of eventId to Votes - same addr can participate multiple events.
    mapping(address => mapping(uint256 => uint256)) public s_participantVotes;

    // @notice the nested mapping:
    // participant Address -> map of TokenPrize to Balance in that token - used to claim prizes for winners.
    mapping(address => mapping(IERC20 => uint256)) public s_participantBalances;

    // @notice price of the voting token
    uint256 votingTokenPriceInWei = 0.01 ether;

    // @notice the token used for voting:
    VotingToken public s_votingToken;

    Counters.Counter private s_eventIdCounter;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address _tokenVoteContractAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        s_votingToken = VotingToken(_tokenVoteContractAddress);
    }

    modifier validParticipants(address[] memory participants) {
        if (participants.length > 10) {
            revert PrizeEventHandler__TooManyParticipantsAtOnce();
        }
        _;
    }

    modifier validParticipant(address participant, uint256 eventId) {
        PrizeEvent memory prizeEvent = s_prizeEvents[eventId];
        if (!addressExists(participant, prizeEvent.participants)) {
            revert PrizeEventHandler__NotValidParticipantForEvent(msg.sender, eventId);
        }
        _;
    }

    modifier validVoter(uint256 eventId, address voter) {
        PrizeEvent memory prizeEvent = getPrizeEvent(eventId);
        bool isValidVoter = addressExists(voter, prizeEvent.voters);
        if (!isValidVoter) {
            revert PrizeEventHandler__VoterNotAllowed(eventId, voter);
        }
        _;
    }

    modifier validEvent(uint256 eventId) {
        if (s_prizeEvents[eventId].owner == address(0)) {
            revert PrizeEventHandler__NotAValidEvent(eventId);
        }
        _;
    }

    modifier onlyOpenEvent(uint256 eventId) {
        PrizeEvent memory prizeEvent = s_prizeEvents[eventId];
        if (prizeEvent.status == EventStatus.CLOSED) {
            revert PrizeEventHandler__EventClosed(eventId);
        }
        _;
    }
    modifier onlyOwnerOf(uint256 eventId) {
        PrizeEvent memory prizeEvent = s_prizeEvents[eventId];
        if (prizeEvent.owner != msg.sender) {
            revert PrizeEventHandler__OnlyOwnerOfEventAllowed();
        }
        _;
    }

    /**
     * @dev defensive code against hughe array of %. Ideally the number should be updatable by contract admin.
     * @notice we need to make sure the distribution is correct otherwise we won;t be able to calculate prize distribution for winners.
     */
    modifier validWinnerDistribution(uint256[] memory array) {
        if (array.length > 6) {
            revert PrizeEventHandler__InvalidWinnerDistribution(array);
        }

        uint256 sum;
        for (uint256 i = 0; i < array.length; i++) {
            sum += array[i];
        }
        if (sum > 100) {
            revert PrizeEventHandler__InvalidWinnerDistribution(array);
        }
        _;
    }

    modifier validClaim(address tokenPrize) {
        if (s_participantBalances[msg.sender][IERC20(tokenPrize)] <= 0) {
            revert PrizeEventHandler__InvalidPrizeClaim(msg.sender, tokenPrize);
        }
        _;
    }

    /**
     * @dev Setups the event on memory and transfers tokens to contract.
     */
    function setupEvent(
        uint256 _prizeAmount,
        uint256 _referenceBlock,
        address _prizeToken,
        uint256[] memory _winnersDistribution,
        address[] memory _voters,
        address[] memory _participants
    ) public validParticipants(_participants) validWinnerDistribution(_winnersDistribution) {
        // (Needs approval first)
        // Transfer the Token:
        IERC20 tokenPrize = IERC20(_prizeToken);

        require(tokenPrize.balanceOf(msg.sender) >= _prizeAmount, "Not enough Tokens to Transfer");
        if (!tokenPrize.transferFrom(msg.sender, address(this), _prizeAmount)) {
            revert PrizeEventHandler__RegistrationFailed(_prizeToken, _prizeAmount);
        }

        // If succeed create the storage:
        registerEvent(
            _prizeAmount,
            _referenceBlock,
            _prizeToken,
            _winnersDistribution,
            _voters,
            _participants
        );
    }

    /**
     * @dev storage event function
     */
    function registerEvent(
        uint256 _prizeAmount,
        uint256 _referenceBlock,
        address _prizeToken,
        uint256[] memory _winnersDistribution,
        address[] memory _voters,
        address[] memory _participants
    ) private {
        uint256 newEventId = s_eventIdCounter.current();

        PrizeEvent memory newPrizeEvent = PrizeEvent(
            s_eventIdCounter.current(),
            msg.sender,
            _prizeAmount,
            _referenceBlock,
            IERC20(_prizeToken),
            _winnersDistribution,
            _voters,
            _participants,
            EventStatus.OPEN
        );

        s_eventsArray.push(newPrizeEvent);
        s_prizeEvents[newEventId] = newPrizeEvent;

        s_eventIdCounter.increment();

        emit PrizeEventCreated(newEventId, _prizeAmount, _referenceBlock);
    }

    function vote(
        uint256 eventId,
        address participant,
        uint256 amountOfVotes
    )
        public
        validEvent(eventId)
        validVoter(eventId, msg.sender)
        onlyOpenEvent(eventId)
        validParticipant(participant, eventId)
    {
        if (!s_votingToken.transferFrom(msg.sender, address(this), amountOfVotes)) {
            revert PrizeEventHandler__VotingFailed(eventId, participant, amountOfVotes);
        }

        s_participantVotes[participant][eventId] += amountOfVotes;
    }

    function registerAsParticipant(uint256 eventId)
        public
        validEvent(eventId)
        onlyOpenEvent(eventId)
    {
        PrizeEvent memory prizeEvent = getPrizeEvent(eventId);
        if (addressExists(msg.sender, prizeEvent.participants)) {
            revert PrizeEventHandler__ParticipantAlreadyRegistered(eventId, msg.sender);
        }
        s_prizeEvents[eventId].participants.push(msg.sender);
    }

    function closeEvent(uint256 eventId)
        public
        validEvent(eventId)
        onlyOwnerOf(eventId)
        onlyOpenEvent(eventId)
    {
        PrizeEvent memory prizeEvent = getPrizeEvent(eventId);
        s_prizeEvents[eventId].status = EventStatus.CLOSED;

        uint256 prizeAmount = prizeEvent.prizeAmount;
        uint256 amountOfWinners = prizeEvent.winnersDistribution.length;

        // Sort participants by votes:
        address[] memory sortedParticipants = sortParticipants(prizeEvent.participants, eventId);

        // Slice winners (no other way for now in solidity):
        address[] memory winners = sliceParticipants(sortedParticipants, amountOfWinners);

        // TODO: what happens when we have ties? --> Out of Scope

        distributePrize(
            winners,
            prizeEvent.winnersDistribution,
            prizeAmount,
            prizeEvent.prizeToken
        );

        emit PrizeEventClosed(eventId, prizeAmount);
    }

    function distributePrize(
        address[] memory winners,
        uint256[] memory winnersDistribution,
        uint256 prizeAmount,
        IERC20 tokenPrize
    ) private {
        require(
            winnersDistribution.length == winners.length,
            "Winners Array & Distribution Array must have the same length"
        );

        for (uint256 i = 0; i < winners.length; i++) {
            uint256 prizeDist = prizeAmount.div(100).mul(winnersDistribution[i]);
            s_participantBalances[winners[i]][tokenPrize] = prizeDist;
        }
    }

    function purchaseVotingToken() public payable {
        require(msg.value >= votingTokenPriceInWei, "Not enough money sent");
        uint256 tokensToTransfer = msg.value.div(votingTokenPriceInWei);
        uint256 remainder = msg.value.sub(tokensToTransfer.mul(votingTokenPriceInWei));

        s_votingToken.mint(msg.sender, tokensToTransfer);
        payable(msg.sender).transfer(remainder);
    }

    /**
     * @notice This methods sorts an array of addresses
     * @dev This sorting is not gas efficent and should be changed to quickSort or something more gas efficent for prod.
     * @dev visibility should be private but worth to unit test it during development.
     */
    function sortParticipants(address[] memory participants, uint256 eventId)
        private
        view
        returns (address[] memory)
    {
        uint256 arraySize = participants.length;
        for (uint256 i = 0; i < arraySize; i++) {
            for (uint256 j = i + 1; j < arraySize; j++) {
                uint256 voteParticipant1 = getVotesForParticipantInEvent(eventId, participants[i]);
                uint256 voteParticipant2 = getVotesForParticipantInEvent(eventId, participants[j]);

                if (voteParticipant1 < voteParticipant2) {
                    address tempAddr = participants[i];
                    participants[i] = participants[j];
                    participants[j] = tempAddr;
                }
            }
        }
        return participants;
    }

    /**
     * @dev visibility should be private but worth to unit test it during development.
     */
    function sliceParticipants(address[] memory participants, uint256 amountOfWinners)
        private
        pure
        returns (address[] memory)
    {
        // Initialize the fixed size memory array so we can assign:
        address[] memory winners = new address[](amountOfWinners);

        if (amountOfWinners >= participants.length) {
            return participants;
        }

        for (uint256 i = 0; i < amountOfWinners; i++) {
            winners[i] = participants[i];
        }

        return winners;
    }

    /**
     * @dev needs approval of prize token first
     */
    function claimPrizeIn(address tokenAddress) public validClaim(tokenAddress) {
        // First update balance then send tokens.
        IERC20 prizeToken = IERC20(tokenAddress);
        uint256 winnerBalance = s_participantBalances[msg.sender][prizeToken];
        s_participantBalances[msg.sender][prizeToken] = 0;
        prizeToken.transfer(msg.sender, winnerBalance);
    }

    function getPrizeEvent(uint256 eventId) public view returns (PrizeEvent memory) {
        return s_prizeEvents[eventId];
    }

    function getVotesForParticipantInEvent(uint256 eventId, address participant)
        public
        view
        returns (uint256)
    {
        return s_participantVotes[participant][eventId];
    }

    function getPrizeTokenAddressFor(uint256 eventId) public view returns (IERC20) {
        return s_prizeEvents[eventId].prizeToken;
    }

    function getParticipantBalanceIn(address participantAddr, address tokenPrize)
        public
        view
        returns (uint256)
    {
        return s_participantBalances[participantAddr][IERC20(tokenPrize)];
    }

    function getParticipantsForEvent(uint256 eventId) public view returns (address[] memory) {
        return s_prizeEvents[eventId].participants;
    }

    function addressExists(address addressaToFind, address[] memory addressesArray)
        public
        pure
        returns (bool)
    {
        for (uint256 i = 0; i < addressesArray.length; i++) {
            if (addressesArray[i] == addressaToFind) {
                return true;
            }
        }

        return false;
    }
}

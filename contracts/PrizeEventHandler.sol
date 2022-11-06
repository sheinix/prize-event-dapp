// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// NOTE: We could be using directly VotingToken but there;s a weird solidity warning bug (https://github.com/ethereum/solidity/issues/11522)
// import "./VotingToken.sol";

interface ITokenizedVotes {
    function getPastVotes(address, uint256) external view returns (uint256);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);
}

error PrizeEventHandler__TooManyParticipantsAtOnce();
error PrizeEventHandler__ApprovalFailed(address token, uint256 amount);
error PrizeEventHandler__RegistrationFailed(address token, uint256 amount);
error PrizeEventHandler__NotAValidEvent(uint256 eventId);
error PrizeEventHandler__VoterNotAllowed(uint256 eventId, address voter);
error PrizeEventHandler__OnlyOwnerOfEventAllowed();
error PrizeEventHandler__VotingFailed(uint256 eventId, address participant, uint256 amountVotes);

contract PrizeEventHandler is AccessControl {
    using Counters for Counters.Counter;

    struct PrizeEvent {
        uint256 eventId;
        address owner;
        uint256 prizeAmount;
        uint256 referenceBlock;
        IERC20 prizeToken;
        // @notice Array of numbers that reprsesents the distribution of price ([50%, 30%, 20%] or [100%] or [40%, 30%, 20%, 10%] etc.)
        uint256[] winnersDistribution;
        address[] voters;
    }

    // Events:
    event PrizeEventCreated(
        uint256 indexed eventId,
        uint256 indexed prizeAmount,
        uint256 indexed referenceBlock
    );

    //@notice the array of prize events created (do we actually need it?)
    PrizeEvent[] public s_eventsArray;

    // @notice the eventId -> PrizeEvent mapping
    mapping(uint256 => PrizeEvent) public s_prizeEvents;

    // @notice the nested mapping:
    // participant Address -> mapp of eventId to Votes - same addr can participate multiple events.
    mapping(address => mapping(uint256 => uint256)) public s_participantVotes;

    ITokenizedVotes public s_votingToken;

    Counters.Counter private s_eventIdCounter;

    constructor(address _tokenVoteContractAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        s_votingToken = ITokenizedVotes(_tokenVoteContractAddress);
    }

    modifier validParticipants(address[] memory participants) {
        if (participants.length > 10) {
            revert PrizeEventHandler__TooManyParticipantsAtOnce();
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

    modifier onlyOwnerOf(uint256 eventId) {
        PrizeEvent memory prizeEvent = s_prizeEvents[eventId];
        if (prizeEvent.owner != msg.sender) {
            revert PrizeEventHandler__OnlyOwnerOfEventAllowed();
        }
        _;
    }

    function setupEvent(
        uint256 _prizeAmount,
        uint256 _referenceBlock,
        address _prizeToken,
        uint256[] memory _winnersDistribution,
        address[] memory _voters,
        address[] memory _participants
    ) public validParticipants(_participants) returns (uint256) {
        // (Needs approval first)
        // Transfer the Token:
        IERC20 tokenPrize = IERC20(_prizeToken);

        if (!tokenPrize.transferFrom(msg.sender, address(this), _prizeAmount)) {
            revert PrizeEventHandler__RegistrationFailed(_prizeToken, _prizeAmount);
        }

        // If succeed create the storage:
        return
            registerEvent(
                _prizeAmount,
                _referenceBlock,
                _prizeToken,
                _winnersDistribution,
                _voters,
                _participants
            );
    }

    function registerEvent(
        uint256 _prizeAmount,
        uint256 _referenceBlock,
        address _prizeToken,
        uint256[] memory _winnersDistribution,
        address[] memory _voters,
        address[] memory _participants
    ) internal validParticipants(_participants) returns (uint256) {
        uint256 newEventId = s_eventIdCounter.current();

        for (uint256 i = 0; i < _participants.length; i++) {
            s_participantVotes[_participants[i]][newEventId] = 0;
        }

        PrizeEvent memory newPrizeEvent = PrizeEvent(
            s_eventIdCounter.current(),
            msg.sender,
            _prizeAmount,
            _referenceBlock,
            IERC20(_prizeToken),
            _winnersDistribution,
            _voters
        );

        s_eventsArray.push(newPrizeEvent);
        s_prizeEvents[newEventId] = newPrizeEvent;

        s_eventIdCounter.increment();

        emit PrizeEventCreated(newEventId, _prizeAmount, _referenceBlock);

        return newEventId;
    }

    function vote(
        uint256 eventId,
        address participant,
        uint256 amountOfVotes
    ) public validEvent(eventId) validVoter(eventId, msg.sender) {
        if (!s_votingToken.transferFrom(msg.sender, address(this), amountOfVotes)) {
            revert PrizeEventHandler__VotingFailed(eventId, participant, amountOfVotes);
        }

        s_participantVotes[participant][eventId] += amountOfVotes;
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

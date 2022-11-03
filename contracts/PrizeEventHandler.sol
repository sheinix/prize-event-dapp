// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITokenizedVotes {
    function getPastVotes(address, uint256) external view returns (uint256);
}

error PrizeEventHandler__TooManyParticipantsAtOnce();
error PrizeEventHandler__ApprovalFailed(address token, uint256 amount);
error PrizeEventHandler__RegistrationFailed(address token, uint256 amount);

contract PrizeEventHandler is AccessControl {
    using Counters for Counters.Counter;

    struct PrizeEvent {
        uint256 eventId;
        uint256 prizeAmount;
        uint256 referenceBlock;
        IERC20 prizeToken;
        // @notice Array of numbers that reprsesents the distribution of price ([50%, 30%, 20%] or [100%] or [40%, 30%, 20%, 10%] etc.)
        uint256[] winnersDistribution;
        address[] voters;
    }

    // Events:
    event PrizeEvebtCreated(
        uint256 indexed eventId,
        uint256 indexed prizeAmount,
        uint256 indexed referenceBlock
    );

    //@notice the array of prize events created
    PrizeEvent[] public s_prizeEvents;

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

    function setupEvent(
        uint256 _prizeAmount,
        uint256 _referenceBlock,
        address _prizeToken,
        uint256[] memory _winnersDistribution,
        address[] memory _voters,
        address[] memory _participants
    ) public validParticipants(_participants) {
        // Need to Approve the contract for the token & amount ✅

        // Transfer the Token:
        IERC20 tokenPrize = IERC20(_prizeToken);

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

    function registerEvent(
        uint256 _prizeAmount,
        uint256 _referenceBlock,
        address _prizeToken,
        uint256[] memory _winnersDistribution,
        address[] memory _voters,
        address[] memory _participants
    ) internal validParticipants(_participants) {
        uint256 newEventId = s_eventIdCounter.current();

        for (uint256 i = 0; i < _participants.length; i++) {
            s_participantVotes[_participants[i]][newEventId] = 0;
        }

        PrizeEvent memory newPrizeEvent = PrizeEvent(
            s_eventIdCounter.current(),
            _prizeAmount,
            _referenceBlock,
            IERC20(_prizeToken),
            _winnersDistribution,
            _voters
        );
        s_prizeEvents.push(newPrizeEvent);

        s_eventIdCounter.increment();

        emit PrizeEvebtCreated(newEventId, _prizeAmount, _referenceBlock);
    }

    function approveToken(address tokenPrize, uint256 amount) public {
        IERC20 eventToken = IERC20(tokenPrize);

        if (!eventToken.approve(address(this), amount)) {
            revert PrizeEventHandler__ApprovalFailed(tokenPrize, amount);
        }
    }
}

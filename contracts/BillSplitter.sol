// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

/**
 * BillSplitter — USDC-only bill splitting with exact-payment enforcement.
 *
 * WHY: Bills are immutable. Amounts and participants cannot change after creation.
 * WHY: Exact payment rule — no partials, no overpay. Contract rejects invalid amounts.
 * WHY: USDC only — all payments in USDC (6 decimals).
 */
contract BillSplitter {
    // ─────────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────────
    event BillCreated(
        bytes32 indexed billId,
        address indexed creator,
        string name,
        string description,
        string customReminderMessage,
        address[] participants,
        uint256 amountPerParticipant
    );

    event BillPaid(
        bytes32 indexed billId,
        address indexed participant,
        bool isConfidential
    );

    // ─────────────────────────────────────────────────────────────────
    // STRUCTS
    // ─────────────────────────────────────────────────────────────────
    struct Bill {
        address creator;
        address usdcToken;
        string name;
        string description;
        uint256 amountPerParticipant;
        address[] participants;
        mapping(address => ParticipantStatus) participantStatus;
    }

    struct ParticipantStatus {
        bool paid;
        bool isConfidential;
        uint256 paidAt;
    }

    // ─────────────────────────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────────────────────────
    mapping(bytes32 => Bill) private bills;
    bytes32[] private billIds;

    // ─────────────────────────────────────────────────────────────────
    // CORE FUNCTIONS
    // ─────────────────────────────────────────────────────────────────

    /**
     * Create a new bill. Name required; description and custom reminder optional.
     */
    function createBill(
        bytes32 billId,
        string calldata name,
        string calldata description,
        string calldata customReminderMessage,
        address usdcToken,
        address[] calldata participants,
        uint256 amountPerParticipant
    ) external {
        require(billId != bytes32(0), "Invalid bill ID");
        require(bytes(name).length > 0, "Name required");
        require(participants.length > 0, "No participants");
        require(amountPerParticipant > 0, "Amount must be > 0");
        require(usdcToken != address(0), "Invalid USDC address");

        Bill storage b = bills[billId];
        require(b.creator == address(0), "Bill already exists");

        b.creator = msg.sender;
        b.usdcToken = usdcToken;
        b.name = name;
        b.description = description;
        b.amountPerParticipant = amountPerParticipant;
        b.participants = participants;

        for (uint256 i = 0; i < participants.length; i++) {
            require(participants[i] != address(0), "Invalid participant");
            b.participantStatus[participants[i]] = ParticipantStatus({
                paid: false,
                isConfidential: false,
                paidAt: 0
            });
        }

        billIds.push(billId);

        emit BillCreated(
            billId,
            msg.sender,
            name,
            description,
            customReminderMessage,
            participants,
            amountPerParticipant
        );
    }

    /**
     * Pay your share — NORMAL (public) mode. USDC only.
     * Participant must approve this contract to spend amountPerParticipant.
     */
    function payNormal(bytes32 billId) external {
        _pay(billId, msg.sender, false);
    }

    /**
     * Mark participant as paid — CONFIDENTIAL mode.
     * PLACEHOLDER: In production, callable only by Fairblock verifier.
     */
    function markPaidConfidential(bytes32 billId, address participant) external {
        Bill storage b = bills[billId];
        require(b.creator != address(0), "Bill does not exist");
        require(
            b.creator == msg.sender || participant == msg.sender,
            "Only creator or participant can mark confidential pay"
        );
        require(_isParticipant(billId, participant), "Not a participant");
        require(!b.participantStatus[participant].paid, "Already paid");

        b.participantStatus[participant] = ParticipantStatus({
            paid: true,
            isConfidential: true,
            paidAt: block.timestamp
        });

        emit BillPaid(billId, participant, true);
    }

    function _pay(bytes32 billId, address participant, bool isConfidential) internal {
        Bill storage b = bills[billId];
        require(b.creator != address(0), "Bill does not exist");
        require(!b.participantStatus[participant].paid, "Already paid");
        require(_isParticipant(billId, participant), "Not a participant");

        uint256 amount = b.amountPerParticipant;

        b.participantStatus[participant] = ParticipantStatus({
            paid: true,
            isConfidential: isConfidential,
            paidAt: block.timestamp
        });

        if (!isConfidential) {
            bool ok = IERC20(b.usdcToken).transferFrom(
                participant,
                b.creator,
                amount
            );
            require(ok, "USDC transfer failed");
        }

        emit BillPaid(billId, participant, isConfidential);
    }

    // ─────────────────────────────────────────────────────────────────
    // VIEW FUNCTIONS
    // ─────────────────────────────────────────────────────────────────

    function getBill(bytes32 billId)
        external
        view
        returns (
            address creator,
            address usdcToken,
            string memory name,
            string memory description,
            uint256 amountPerParticipant,
            address[] memory participants
        )
    {
        Bill storage b = bills[billId];
        require(b.creator != address(0), "Bill does not exist");
        return (
            b.creator,
            b.usdcToken,
            b.name,
            b.description,
            b.amountPerParticipant,
            b.participants
        );
    }

    function _isParticipant(bytes32 billId, address addr) internal view returns (bool) {
        Bill storage b = bills[billId];
        if (b.creator == address(0)) return false;
        for (uint256 i = 0; i < b.participants.length; i++) {
            if (b.participants[i] == addr) return true;
        }
        return false;
    }

    function isParticipant(bytes32 billId, address addr) external view returns (bool) {
        return _isParticipant(billId, addr);
    }

    function getParticipantStatus(bytes32 billId, address participant)
        external
        view
        returns (bool paid, bool isConfidential, uint256 paidAt)
    {
        Bill storage b = bills[billId];
        require(b.creator != address(0), "Bill does not exist");
        ParticipantStatus storage ps = b.participantStatus[participant];
        return (ps.paid, ps.isConfidential, ps.paidAt);
    }

    function getBillIds() external view returns (bytes32[] memory) {
        return billIds;
    }
}

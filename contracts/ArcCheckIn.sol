// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Daily wallet check-in. The caller pays network gas only.
/// @dev Each UTC day is block.timestamp / 1 days. There is no administrator.
contract ArcCheckIn {
    struct UserStats {
        uint256 totalCheckIns;
        uint256 lastCheckInDay;
        uint256 currentStreak;
        uint256 longestStreak;
    }

    mapping(address => UserStats) private _users;
    mapping(address => mapping(uint256 => bool)) public hasCheckedIn;

    uint256 public totalCheckIns;
    uint256 public totalUsers;

    error AlreadyCheckedIn(uint256 day);

    event CheckedIn(
        address indexed user,
        uint256 indexed day,
        uint256 totalCheckIns,
        uint256 currentStreak
    );

    /// @notice Record today's check-in without paying a project fee.
    /// @dev Nonpayable: sending native currency along with the call reverts.
    function checkIn() external {
        uint256 day = block.timestamp / 1 days;
        if (hasCheckedIn[msg.sender][day]) revert AlreadyCheckedIn(day);

        UserStats storage user = _users[msg.sender];
        if (user.totalCheckIns == 0) {
            totalUsers += 1;
            user.currentStreak = 1;
        } else if (user.lastCheckInDay + 1 == day) {
            user.currentStreak += 1;
        } else {
            user.currentStreak = 1;
        }

        user.totalCheckIns += 1;
        user.lastCheckInDay = day;
        if (user.currentStreak > user.longestStreak) {
            user.longestStreak = user.currentStreak;
        }

        hasCheckedIn[msg.sender][day] = true;
        totalCheckIns += 1;
        emit CheckedIn(msg.sender, day, user.totalCheckIns, user.currentStreak);
    }

    /// @notice Read a wallet's statistics, including whether it checked in today.
    /// @dev A streak stays active through the following day, then expires to zero.
    function getStats(address account)
        external
        view
        returns (
            uint256 totalCheckIns,
            uint256 lastCheckInDay,
            uint256 currentStreak,
            uint256 longestStreak,
            bool checkedInToday
        )
    {
        UserStats storage user = _users[account];
        uint256 day = block.timestamp / 1 days;
        return (
            user.totalCheckIns,
            user.lastCheckInDay,
            user.lastCheckInDay + 1 < day ? 0 : user.currentStreak,
            user.longestStreak,
            hasCheckedIn[account][day]
        );
    }
}

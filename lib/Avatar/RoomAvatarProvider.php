<?php

declare(strict_types=1);

/**
 * @copyright Copyright (c) 2020, Daniel Calviño Sánchez (danxuliu@gmail.com)
 *
 * @author Daniel Calviño Sánchez <danxuliu@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */

namespace OCA\Talk\Avatar;

use OCA\Talk\Exceptions\ParticipantNotFoundException;
use OCA\Talk\Exceptions\RoomNotFoundException;
use OCA\Talk\Manager;
use OCA\Talk\Participant;
use OCA\Talk\Room;
use OCA\Talk\TalkSession;
use OCP\Files\IAppData;
use OCP\Files\NotFoundException;
use OCP\IAvatar;
use OCP\IAvatarProvider;
use OCP\IL10N;
use Psr\Log\LoggerInterface;

class RoomAvatarProvider implements IAvatarProvider {

	/** @var string|null */
	protected $userId;

	/** @var TalkSession */
	protected $session;

	/** @var IAppData */
	private $appData;

	/** @var Manager */
	private $manager;

	/** @var IL10N */
	private $l;

	/** @var LoggerInterface */
	private $logger;

	public function __construct(
			?string $userId,
			TalkSession $session,
			IAppData $appData,
			Manager $manager,
			IL10N $l,
			LoggerInterface $logger) {
		$this->userId = $userId;
		$this->session = $session;
		$this->appData = $appData;
		$this->manager = $manager;
		$this->l = $l;
		$this->logger = $logger;
	}

	/**
	 * Returns a RoomAvatar instance for the given room token.
	 *
	 * @param string $id the identifier of the avatar.
	 * @returns the RoomAvatar.
	 * @throws RoomNotFoundException if there is no room with the given token.
	 */
	public function getAvatar(string $id): IAvatar {
		$room = $this->manager->getRoomByToken($id);

		try {
			$folder = $this->appData->getFolder('talk');
		} catch (NotFoundException $e) {
			$folder = $this->appData->newFolder('talk');
		}

		return new RoomAvatar($folder, $room, $this->l, $this->logger);
	}

	/**
	 * Returns whether the current user can access the given avatar or not.
	 *
	 * @param IAvatar $avatar the avatar to check
	 * @return bool true if the room is public or the current user is a
	 *         participant of the room, false otherwise
	 * @throws \InvalidArgumentException if the given avatar is not a RoomAvatar
	 */
	public function canBeAccessedByCurrentUser(IAvatar $avatar): bool {
		if (!($avatar instanceof RoomAvatar)) {
			throw new \InvalidArgumentException();
		}

		$room = $avatar->getRoom();

		if ($room->getType() === Room::PUBLIC_CALL) {
			return true;
		}

		try {
			$this->getCurrentParticipant($room);
		} catch (ParticipantNotFoundException $e) {
			return false;
		}

		return true;
	}

	/**
	 * Returns whether the current user can modify the given avatar or not.
	 *
	 * @param IAvatar $avatar the avatar to check
	 * @return bool true if the current user is a moderator of the room and the
	 *         room is not a one-to-one, password request or file room, false
	 *         otherwise
	 * @throws \InvalidArgumentException if the given avatar is not a RoomAvatar
	 */
	public function canBeModifiedByCurrentUser(IAvatar $avatar): bool {
		if (!($avatar instanceof RoomAvatar)) {
			throw new \InvalidArgumentException();
		}

		$room = $avatar->getRoom();

		if ($room->getType() === Room::ONE_TO_ONE_CALL) {
			return false;
		}

		if ($room->getObjectType() === 'share:password') {
			return false;
		}

		if ($room->getObjectType() === 'file') {
			return false;
		}

		try {
			$currentParticipant = $this->getCurrentParticipant($room);
		} catch (ParticipantNotFoundException $e) {
			return false;
		}

		return $currentParticipant->hasModeratorPermissions();
	}

	/**
	 * @param Room $room
	 * @return Participant
	 * @throws ParticipantNotFoundException
	 */
	private function getCurrentParticipant(Room $room): Participant {
		$participant = null;
		try {
			$participant = $room->getParticipant($this->userId);
		} catch (ParticipantNotFoundException $e) {
			$participant = $room->getParticipantBySession($this->session->getSessionForRoom($room->getToken()));
		}

		return $participant;
	}

	/**
	 * Returns the latest value of the avatar version
	 *
	 * @param IAvatar $avatar ignored
	 * @return int 0, as versions are not supported by room avatars
	 */
	public function getVersion(IAvatar $avatar): int {
		return 0;
	}

	/**
	 * Returns the cache duration for room avatars in seconds
	 *
	 * @param IAvatar $avatar ignored, same duration for all room avatars
	 * @return int|null the cache duration
	 */
	public function getCacheTimeToLive(IAvatar $avatar): ?int {
		// Cache for 1 day.
		return 60 * 60 * 24;
	}

}

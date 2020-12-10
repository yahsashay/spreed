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

use OCA\Talk\Exceptions\RoomNotFoundException;
use OCA\Talk\Manager;
use OCP\Files\IAppData;
use OCP\Files\NotFoundException;
use OCP\IAvatar;
use OCP\IAvatarProvider;
use OCP\IL10N;
use Psr\Log\LoggerInterface;

class RoomAvatarProvider implements IAvatarProvider {

	/** @var IAppData */
	private $appData;

	/** @var Manager */
	private $manager;

	/** @var IL10N */
	private $l;

	/** @var LoggerInterface */
	private $logger;

	public function __construct(
			IAppData $appData,
			Manager $manager,
			IL10N $l,
			LoggerInterface $logger) {
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

}

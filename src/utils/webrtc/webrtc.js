/**
 * @copyright Copyright (c) 2019 Daniel Calviño Sánchez <danxuliu@gmail.com>
 * @copyright Copyright (c) 2019 Ivan Sein <ivan@nextcloud.com>
 * @copyright Copyright (c) 2019 Joachim Bauch <bauch@struktur.de>
 * @copyright Copyright (c) 2019 Joas Schilling <coding@schilljs.com>
 *
 * @author Daniel Calviño Sánchez <danxuliu@gmail.com>
 * @author Ivan Sein <ivan@nextcloud.com>
 * @author Joachim Bauch <bauch@struktur.de>
 * @author Joas Schilling <coding@schilljs.com>
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
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

import SimpleWebRTC from './simplewebrtc/simplewebrtc'
import { PARTICIPANT } from '../../constants.js'
import store from '../../store/index.js'
import {
	showError,
	TOAST_PERMANENT_TIMEOUT,
	TOAST_DEFAULT_TIMEOUT,
} from '@nextcloud/dialogs'

let webrtc
const spreedPeerConnectionTable = []

let previousUsersInRoom = []
let usersInCallMapping = {}
let ownPeer = null
let ownScreenPeer = null
let selfInCall = PARTICIPANT.CALL_FLAG.DISCONNECTED
const delayedConnectionToPeer = []
let callParticipantCollection = null
let localCallParticipantModel = null
let showedTURNWarning = false
let sendCurrentStateWithRepetitionTimeout = null

function arrayDiff(a, b) {
	return a.filter(function(i) {
		return b.indexOf(i) < 0
	})
}

function createScreensharingPeer(signaling, sessionId) {
	const currentSessionId = signaling.getSessionId()
	const useMcu = signaling.hasFeature('mcu')

	if (useMcu && !webrtc.webrtc.getPeers(currentSessionId, 'screen').length) {
		if (ownScreenPeer) {
			ownScreenPeer.end()
		}

		// Create own publishing stream.
		ownScreenPeer = webrtc.webrtc.createPeer({
			id: currentSessionId,
			type: 'screen',
			sharemyscreen: true,
			enableDataChannels: false,
			receiveMedia: {
				offerToReceiveAudio: 0,
				offerToReceiveVideo: 0,
			},
			broadcaster: currentSessionId,
		})
		webrtc.emit('createdPeer', ownScreenPeer)
		ownScreenPeer.start()

		localCallParticipantModel.setScreenPeer(ownScreenPeer)
	}

	if (sessionId === currentSessionId) {
		return
	}

	if (useMcu) {
		// TODO(jojo): Already create peer object to avoid duplicate offers.
		// TODO(jojo): We should use "requestOffer" as with regular
		// audio/video peers. Not possible right now as there is no way
		// for clients to know that screensharing is active and an offer
		// from the MCU should be requested.
		signaling.sendOffer(sessionId, 'screen')
	} else if (!useMcu) {
		const screenPeers = webrtc.webrtc.getPeers(sessionId, 'screen')
		const screenPeerSharedTo = screenPeers.find(function(screenPeer) {
			return screenPeer.sharemyscreen === true
		})
		if (!screenPeerSharedTo) {
			const peer = webrtc.webrtc.createPeer({
				id: sessionId,
				type: 'screen',
				sharemyscreen: true,
				enableDataChannels: false,
				receiveMedia: {
					offerToReceiveAudio: 0,
					offerToReceiveVideo: 0,
				},
				broadcaster: currentSessionId,
			})
			webrtc.emit('createdPeer', peer)
			peer.start()
		}
	}
}

function checkStartPublishOwnPeer(signaling) {
	'use strict'
	const currentSessionId = signaling.getSessionId()
	if (!webrtc.webrtc.localStreams.length || webrtc.webrtc.getPeers(currentSessionId, 'video').length) {
		// No media yet or already publishing.
		return
	}

	if (ownPeer) {
		webrtc.removePeers(ownPeer.id)
		ownPeer.end()
	}

	// Create own publishing stream.
	ownPeer = webrtc.webrtc.createPeer({
		id: currentSessionId,
		type: 'video',
		enableDataChannels: true,
		receiveMedia: {
			offerToReceiveAudio: 0,
			offerToReceiveVideo: 0,
		},
		sendVideoIfAvailable: signaling.getSendVideoIfAvailable(),
	})
	webrtc.emit('createdPeer', ownPeer)
	ownPeer.start()

	localCallParticipantModel.setPeer(ownPeer)
}

function sendCurrentMediaState() {
	if (!webrtc.webrtc.isVideoEnabled()) {
		webrtc.webrtc.emit('videoOff')
	} else {
		webrtc.webrtc.emit('videoOn')
	}
	if (!webrtc.webrtc.isAudioEnabled()) {
		webrtc.webrtc.emit('audioOff')
	} else {
		webrtc.webrtc.emit('audioOn')
	}
}

// TODO The participant name should be got from the participant list, but it is
// not currently possible to associate a Nextcloud ID with a standalone
// signaling ID for guests.
function sendCurrentNick() {
	webrtc.webrtc.emit('nickChanged', store.getters.getDisplayName())
}

function sendCurrentStateWithRepetition(timeout) {
	if (!timeout) {
		timeout = 0

		clearTimeout(sendCurrentStateWithRepetitionTimeout)
	}

	sendCurrentStateWithRepetitionTimeout = setTimeout(function() {
		sendCurrentMediaState()
		sendCurrentNick()

		if (!timeout) {
			timeout = 1000
		} else {
			timeout *= 2
		}

		if (timeout > 16000) {
			sendCurrentStateWithRepetitionTimeout = null
			return
		}

		sendCurrentStateWithRepetition(timeout)
	}, timeout)
}

function userHasStreams(user) {
	let flags = user
	if (flags.hasOwnProperty('inCall')) {
		flags = flags.inCall
	}
	flags = flags || PARTICIPANT.CALL_FLAG.DISCONNECTED
	const REQUIRED_FLAGS = PARTICIPANT.CALL_FLAG.WITH_AUDIO | PARTICIPANT.CALL_FLAG.WITH_VIDEO
	return (flags & REQUIRED_FLAGS) !== 0
}

function usersChanged(signaling, newUsers, disconnectedSessionIds) {
	'use strict'
	const currentSessionId = signaling.getSessionId()

	const useMcu = signaling.hasFeature('mcu')
	if (useMcu && newUsers.length) {
		checkStartPublishOwnPeer(signaling)
	}

	newUsers.forEach(function(user) {
		if (!user.inCall) {
			return
		}

		// TODO(fancycode): Adjust property name of internal PHP backend to be all lowercase.
		const sessionId = user.sessionId || user.sessionid
		if (!sessionId || sessionId === currentSessionId || previousUsersInRoom.indexOf(sessionId) !== -1) {
			return
		}

		previousUsersInRoom.push(sessionId)

		// Use null to differentiate between guest (null) and not known yet
		// (undefined).
		// TODO(fancycode): Adjust property name of internal PHP backend to be all lowercase.
		const userId = user.userId || user.userid || null

		let callParticipantModel = callParticipantCollection.get(sessionId)
		if (!callParticipantModel) {
			callParticipantModel = callParticipantCollection.add({
				peerId: sessionId,
				webRtc: webrtc,
			})
		}
		callParticipantModel.setUserId(userId)
		if (user.internal) {
			callParticipantModel.set('internal', true)
		}

		// When the MCU is used and the other participant has no streams or
		// when no MCU is used and neither the local participant nor the
		// other one has no streams there will be no Peer for that other
		// participant, so a null Peer needs to be explicitly set now.
		if ((signaling.hasFeature('mcu') && user && !userHasStreams(user))
				|| (!signaling.hasFeature('mcu') && user && !userHasStreams(user) && !webrtc.webrtc.localStreams.length)) {
			callParticipantModel.setPeer(null)

			// As there is no Peer for the other participant the current state
			// will not be sent once it is connected, so it needs to be sent
			// now.
			// When there is no MCU this is only needed for the nick; as the
			// local participant has no streams it will be automatically marked
			// with audio and video not available on the other end, so there is
			// no need to send the media state.
			if (signaling.hasFeature('mcu')) {
				sendCurrentStateWithRepetition()
			} else {
				sendCurrentNick()
			}
		}

		const createPeer = function() {
			const peer = webrtc.webrtc.createPeer({
				id: sessionId,
				type: 'video',
				enableDataChannels: true,
				receiveMedia: {
					offerToReceiveAudio: 1,
					offerToReceiveVideo: 1,
				},
				sendVideoIfAvailable: signaling.getSendVideoIfAvailable(),
			})
			webrtc.emit('createdPeer', peer)
			peer.start()
		}

		if (!webrtc.webrtc.getPeers(sessionId, 'video').length) {
			if (useMcu && userHasStreams(user)) {
				// TODO(jojo): Already create peer object to avoid duplicate offers.
				signaling.requestOffer(user, 'video')

				delayedConnectionToPeer[user.sessionId] = setInterval(function() {
					console.debug('No offer received for new peer, request offer again')

					signaling.requestOffer(user, 'video')
				}, 10000)
			} else if (!useMcu && userHasStreams(selfInCall) && (!userHasStreams(user) || sessionId < currentSessionId)) {
				// To avoid overloading the user joining a room (who previously called
				// all the other participants), we decide who calls who by comparing
				// the session ids of the users: "larger" ids call "smaller" ones.
				console.debug('Starting call with', user)
				createPeer()
			} else if (!useMcu && userHasStreams(selfInCall) && userHasStreams(user) && sessionId > currentSessionId) {
				// If the remote peer is not aware that it was disconnected
				// from the current peer the remote peer will not send a new
				// offer; thus, if the current peer does not receive a new
				// offer in a reasonable time, the current peer calls the
				// remote peer instead of waiting to be called to
				// reestablish the connection.
				delayedConnectionToPeer[sessionId] = setInterval(function() {
					// New offers are periodically sent until a connection
					// is established. As an offer can not be sent again
					// from an existing peer it must be removed and a new
					// one must be created from scratch.
					webrtc.webrtc.getPeers(sessionId, 'video').forEach(function(peer) {
						peer.end()
					})

					console.debug('No offer nor answer received, sending offer again')
					createPeer()
				}, 10000)
			} else {
				console.debug('User has no streams, not sending another offer')
			}
		}

		// Send shared screen to new participants
		if (webrtc.getLocalScreen()) {
			createScreensharingPeer(signaling, sessionId)
		}
	})

	disconnectedSessionIds.forEach(function(sessionId) {
		console.debug('Remove disconnected peer', sessionId)
		webrtc.removePeers(sessionId)
		callParticipantCollection.remove(sessionId)
		if (delayedConnectionToPeer[sessionId]) {
			clearInterval(delayedConnectionToPeer[sessionId])
			delete delayedConnectionToPeer[sessionId]
		}
	})

	previousUsersInRoom = arrayDiff(previousUsersInRoom, disconnectedSessionIds)
}

function usersInCallChanged(signaling, users) {
	// The passed list are the users that are currently in the room,
	// i.e. that are in the call and should call each other.
	const currentSessionId = signaling.getSessionId()
	const currentUsersInRoom = []
	const userMapping = {}
	selfInCall = PARTICIPANT.CALL_FLAG.DISCONNECTED
	let sessionId
	for (sessionId in users) {
		if (!users.hasOwnProperty(sessionId)) {
			continue
		}
		const user = users[sessionId]
		if (!user.inCall) {
			continue
		}

		if (sessionId === currentSessionId) {
			selfInCall = user.inCall
			continue
		}

		currentUsersInRoom.push(sessionId)
		userMapping[sessionId] = user
	}

	if (!selfInCall) {
		// Own session is no longer in the call, disconnect from all others.
		usersChanged(signaling, [], previousUsersInRoom)
		return
	}

	const newSessionIds = arrayDiff(currentUsersInRoom, previousUsersInRoom)
	const disconnectedSessionIds = arrayDiff(previousUsersInRoom, currentUsersInRoom)
	const newUsers = []
	newSessionIds.forEach(function(sessionId) {
		newUsers.push(userMapping[sessionId])
	})
	if (newUsers.length || disconnectedSessionIds.length) {
		usersChanged(signaling, newUsers, disconnectedSessionIds)
	}
}

export default function initWebRTC(signaling, _callParticipantCollection, _localCallParticipantModel) {
	callParticipantCollection = _callParticipantCollection
	localCallParticipantModel = _localCallParticipantModel

	signaling.on('usersLeft', function(users) {
		users.forEach(function(user) {
			delete usersInCallMapping[user]
		})
		usersChanged(signaling, [], users)
	})
	signaling.on('usersChanged', function(users) {
		users.forEach(function(user) {
			const sessionId = user.sessionId || user.sessionid
			usersInCallMapping[sessionId] = user
		})
		usersInCallChanged(signaling, usersInCallMapping)
	})
	signaling.on('participantFlagsChanged', function(event) {
		/**
		 * event {
		 *   roomid: "1609407087",
		 *   sessionid: "…",
		 *   flags: 1
		 * }
		 */
		const callParticipantModel = callParticipantCollection.get(event.sessionid)
		if (callParticipantModel) {
			callParticipantModel.set('speaking', (event.flags & PARTICIPANT.SIP_FLAG.SPEAKING) > 0)
			callParticipantModel.set('audioAvailable', (event.flags & PARTICIPANT.SIP_FLAG.MUTE_MICROPHONE) === 0)
			callParticipantModel.set('raisedHand', {
				state: (event.flags & PARTICIPANT.SIP_FLAG.RAISE_HAND) === 0,
				timestamp: Date.now(),
			})
		}
	})
	signaling.on('usersInRoom', function(users) {
		usersInCallMapping = {}
		users.forEach(function(user) {
			const sessionId = user.sessionId || user.sessionid
			usersInCallMapping[sessionId] = user
		})
		usersInCallChanged(signaling, usersInCallMapping)
	})
	signaling.on('leaveCall', function(token, reconnect) {
		// When the MCU is used and there is a connection error the call is
		// left and then joined again to perform the reconnection. In those
		// cases the call should be kept active from the point of view of
		// WebRTC.
		if (reconnect) {
			return
		}

		clearErrorNotification()
		webrtc.leaveCall()
	})

	signaling.on('message', function(message) {
		if (message.type === 'answer' && message.roomType === 'video' && delayedConnectionToPeer[message.from]) {
			clearInterval(delayedConnectionToPeer[message.from])
			delete delayedConnectionToPeer[message.from]

			return
		}

		if (message.type !== 'offer') {
			return
		}

		const peers = webrtc.webrtc.peers
		const stalePeer = peers.find(function(peer) {
			if (peer.sharemyscreen) {
				return false
			}

			return peer.id === message.from && peer.type === message.roomType && peer.sid !== message.sid
		})

		if (stalePeer) {
			stalePeer.end()
		}

		if (message.roomType === 'video' && delayedConnectionToPeer[message.from]) {
			clearInterval(delayedConnectionToPeer[message.from])
			delete delayedConnectionToPeer[message.from]
		}

		if (!selfInCall) {
			console.debug('Offer received when not in the call, ignore')

			message.type = 'offer-to-ignore'
		}

		// MCU screen offers do not include the "broadcaster" property,
		// which is expected by SimpleWebRTC in screen offers from a remote
		// peer, so it needs to be explicitly added.
		if (signaling.hasFeature('mcu') && message.roomType === 'screen') {
			message.broadcaster = message.from
		}
	})

	webrtc = new SimpleWebRTC({
		remoteVideosEl: '',
		autoRequestMedia: true,
		debug: false,
		media: {
			audio: true,
			video: true,
		},
		autoAdjustMic: false,
		audioFallback: true,
		detectSpeakingEvents: true,
		connection: signaling,
		enableDataChannels: true,
		nick: store.getters.getDisplayName(),
	})
	if (signaling.hasFeature('mcu')) {
		// Force "Plan-B" semantics if the MCU is used, which doesn't support
		// "Unified Plan" with SimpleWebRTC yet.
		webrtc.webrtc.config.peerConnectionConfig.sdpSemantics = 'plan-b'
	}

	if (!window.OCA.Talk) {
		window.OCA.Talk = {}
	}
	window.OCA.Talk.SimpleWebRTC = webrtc

	signaling.on('pullMessagesStoppedOnFail', function() {
		// Force leaving the call in WebRTC; when pulling messages stops due
		// to failures the room is left, and leaving the room indirectly
		// runs signaling.leaveCurrentCall(), but if the signaling fails to
		// leave the call (which is likely due to the messages failing to be
		// received) no event will be triggered and the call will not be
		// left from WebRTC point of view.
		webrtc.leaveCall()
	})

	webrtc.startMedia = function(token) {
		webrtc.joinCall(token)
	}

	const sendDataChannelToAll = function(channel, message, payload) {
		// If running with MCU, the message must be sent through the
		// publishing peer and will be distributed by the MCU to subscribers.
		if (ownPeer && signaling.hasFeature && signaling.hasFeature('mcu')) {
			ownPeer.sendDirectly(channel, message, payload)
			return
		}
		webrtc.sendDirectlyToAll(channel, message, payload)
	}

	function handleIceConnectionStateConnected(peer) {
		// Send the current information about the state.
		if (!signaling.hasFeature('mcu')) {
			// Only the media state needs to be sent, the nick was already sent
			// in the offer/answer.
			sendCurrentMediaState()
		} else {
			sendCurrentStateWithRepetition()
		}

		// Reset ice restart counter for peer
		if (spreedPeerConnectionTable[peer.id] > 0) {
			spreedPeerConnectionTable[peer.id] = 0
		}
	}

	function handleIceConnectionStateDisconnected(peer) {
		setTimeout(function() {
			if (peer.pc.iceConnectionState !== 'disconnected') {
				return
			}

			peer.emit('extendedIceConnectionStateChange', 'disconnected-long')

			if (!signaling.hasFeature('mcu')) {
				// Disconnections are not handled with the MCU, only
				// failures.

				// If the peer is still disconnected after 5 seconds we try
				// ICE restart.
				if (spreedPeerConnectionTable[peer.id] < 5) {
					if (peer.pc.localDescription.type === 'offer'
							&& peer.pc.signalingState === 'stable') {
						spreedPeerConnectionTable[peer.id]++
						console.debug('ICE restart after disconnect.', peer)
						peer.icerestart()
					}
				}
			}
		}, 5000)
	}

	function handleIceConnectionStateFailed(peer) {
		if (!showedTURNWarning && !signaling.settings.turnservers.length) {
			showError(
				t('spreed', 'Could not establish a connection with at least one participant. A TURN server might be needed for your scenario. Please ask your administrator to set one up following {linkstart}this documentation{linkend}.')
					.replace('{linkstart}', '<a  target="_blank" rel="noreferrer nofollow" class="external" href="https://nextcloud-talk.readthedocs.io/en/latest/TURN/">')
					.replace('{linkend}', ' ↗</a>'),
				{
					timeout: TOAST_PERMANENT_TIMEOUT,
					isHTML: true,
				}
			)
			showedTURNWarning = true
		}

		if (!signaling.hasFeature('mcu')) {
			if (spreedPeerConnectionTable[peer.id] < 5) {
				if (peer.pc.localDescription.type === 'offer'
						&& peer.pc.signalingState === 'stable') {
					spreedPeerConnectionTable[peer.id]++
					console.debug('ICE restart after failure.', peer)
					peer.icerestart()
				}
			} else {
				console.error('ICE failed after 5 tries.', peer)

				peer.emit('extendedIceConnectionStateChange', 'failed-no-restart')
			}
		} else {
			// This handles ICE failures of a receiver peer; ICE failures of
			// the sender peer are handled in the "iceFailed" event.
			console.debug('Request offer again', peer)

			signaling.requestOffer(peer.id, 'video')

			delayedConnectionToPeer[peer.id] = setInterval(function() {
				console.debug('No offer received, request offer again', peer)

				signaling.requestOffer(peer.id, 'video')
			}, 10000)
		}
	}

	function setHandlerForIceConnectionStateChange(peer) {
		// Initialize ice restart counter for peer
		spreedPeerConnectionTable[peer.id] = 0

		peer.pc.addEventListener('iceconnectionstatechange', function() {
			peer.emit('extendedIceConnectionStateChange', peer.pc.iceConnectionState)

			switch (peer.pc.iceConnectionState) {
			case 'checking':
				console.debug('Connecting to peer...', peer)

				break
			case 'connected':
			case 'completed': // on caller side
				console.debug('Connection established.', peer)

				handleIceConnectionStateConnected(peer)
				break
			case 'disconnected':
				console.debug('Disconnected.', peer)

				handleIceConnectionStateDisconnected(peer)
				break
			case 'failed':
				console.debug('Connection failed.', peer)

				handleIceConnectionStateFailed(peer)
				break
			case 'closed':
				console.debug('Connection closed.', peer)

				break
			}
		})
	}

	const forceReconnect = function(signaling, flags) {
		if (ownPeer) {
			webrtc.removePeers(ownPeer.id)
			ownPeer.end()
			ownPeer = null

			localCallParticipantModel.setPeer(ownPeer)
		}

		usersChanged(signaling, [], previousUsersInRoom)
		usersInCallMapping = {}
		previousUsersInRoom = []

		// Reconnects with a new session id will trigger "usersChanged"
		// with the users in the room and that will re-establish the
		// peerconnection streams.
		// If flags are undefined the current call flags are used.
		signaling.forceReconnect(true, flags)
	}

	function setHandlerForNegotiationNeeded(peer) {
		peer.pc.addEventListener('negotiationneeded', function() {
			// Negotiation needed will be first triggered before the connection
			// is established, but forcing a reconnection should be done only
			// once the connection was established.
			if (peer.pc.iceConnectionState !== 'new' && peer.pc.iceConnectionState !== 'checking') {
				forceReconnect(signaling)
			}
		})
	}

	webrtc.on('createdPeer', function(peer) {
		console.debug('Peer created', peer)

		if (peer.id !== signaling.getSessionId() && !peer.sharemyscreen) {
			// In some strange cases a Peer can be added before its
			// participant is found in the list of participants.
			let callParticipantModel = callParticipantCollection.get(peer.id)
			if (!callParticipantModel) {
				callParticipantModel = callParticipantCollection.add({
					peerId: peer.id,
					webRtc: webrtc,
				})
			}

			if (peer.type === 'video') {
				callParticipantModel.setPeer(peer)
			} else {
				callParticipantModel.setScreenPeer(peer)
			}
		}

		if (peer.type === 'video') {
			if (peer.id === signaling.getSessionId()) {
				console.debug('Not adding ICE connection state handler for own peer', peer)
			} else {
				setHandlerForIceConnectionStateChange(peer)
			}

			setHandlerForNegotiationNeeded(peer)

			// Make sure required data channels exist for all peers. This
			// is required for peers that get created by SimpleWebRTC from
			// received "Offer" messages. Otherwise the "channelMessage"
			// will not be called.
			peer.getDataChannel('status')
		}
	})

	function checkPeerMedia(peer, track, mediaType) {
		return new Promise((resolve, reject) => {
			peer.pc.getStats(track).then(function(stats) {
				let result = false
				stats.forEach(function(statsReport) {
					if (result || statsReport.mediaType !== mediaType || !statsReport.hasOwnProperty('bytesReceived')) {
						return
					}

					if (statsReport.bytesReceived > 0) {
						if (mediaType === 'video' && statsReport.bytesReceived < 2000) {
							// A video with less than 2000 bytes is an empty single frame of the MCU
							// console.debug('Participant is registered with with video but didn\'t send a lot of data, so we assume the video is disabled for now.')
							result = true
							return
						}
						webrtc.emit('unmute', {
							id: peer.id,
							name: mediaType,
						})
						result = true
					}
				})
				if (result) {
					resolve()
				} else {
					reject(new Error('No bytes received'))
				}
			})
		})
	}

	function stopPeerCheckAudioMedia(peer) {
		clearInterval(peer.check_audio_interval)
		peer.check_audio_interval = null
	}

	function stopPeerCheckVideoMedia(peer) {
		clearInterval(peer.check_video_interval)
		peer.check_video_interval = null
	}

	function stopPeerIdCheckMediaType(peerId, mediaType) {
		// There should be just one video peer with that id, but iterating is
		// safer.
		const peers = webrtc.getPeers(peerId, 'video')
		peers.forEach(function(peer) {
			if (mediaType === 'audio') {
				stopPeerCheckAudioMedia(peer)
			} else if (mediaType === 'video') {
				stopPeerCheckVideoMedia(peer)
			}
		})
	}

	if (signaling.hasFeature('mcu')) {
		webrtc.on('mute', function(data) {
			stopPeerIdCheckMediaType(data.id, data.name)
		})
		webrtc.on('unmute', function(data) {
			stopPeerIdCheckMediaType(data.id, data.name)
		})
	}

	function stopPeerCheckMedia(peer) {
		stopPeerCheckAudioMedia(peer)
		stopPeerCheckVideoMedia(peer)
	}

	function startPeerCheckMedia(peer, stream) {
		stopPeerCheckMedia(peer)
		peer.check_video_interval = setInterval(function() {
			stream.getVideoTracks().forEach(function(video) {
				checkPeerMedia(peer, video, 'video').then(function() {
					stopPeerCheckVideoMedia(peer)
				}).catch(() => {
				})
			})
		}, 1000)
		peer.check_audio_interval = setInterval(function() {
			stream.getAudioTracks().forEach(function(audio) {
				checkPeerMedia(peer, audio, 'audio').then(function() {
					stopPeerCheckAudioMedia(peer)
				}).catch(() => {
				})
			})
		}, 1000)
	}

	webrtc.on('peerStreamAdded', function(peer) {
		// With the MCU, a newly subscribed stream might not get the
		// "audioOn"/"videoOn" messages as they are only sent when
		// a user starts publishing. Instead wait for initial data
		// and trigger events locally.
		if (!signaling.hasFeature('mcu')) {
			return
		}

		if (peer.type === 'screen') {
			return
		}

		startPeerCheckMedia(peer, peer.stream)
	})

	webrtc.on('peerStreamRemoved', function(peer) {
		stopPeerCheckMedia(peer)
	})

	webrtc.webrtc.on('videoOn', function() {
		if (signaling.getSendVideoIfAvailable()) {
			return
		}

		// When enabling the local video if the video is not being sent a
		// reconnection is forced to start sending it.
		signaling.setSendVideoIfAvailable(true)

		let flags = signaling.getCurrentCallFlags()
		flags |= PARTICIPANT.CALL_FLAG.WITH_VIDEO

		forceReconnect(signaling, flags)
	})

	webrtc.webrtc.on('iceFailed', function(/* peer */) {
		if (!signaling.hasFeature('mcu')) {
			// ICE restarts will be handled by "iceConnectionStateChange"
			// above.
			return
		}

		// For now assume the connection to the MCU is interrupted on ICE
		// failures and force a reconnection of all streams.
		forceReconnect(signaling)
	})

	let localStreamRequestedTimeout = null
	let localStreamRequestedTimeoutNotification = null

	let errorNotificationHandle = null

	const clearLocalStreamRequestedTimeoutAndHideNotification = function() {
		clearTimeout(localStreamRequestedTimeout)
		localStreamRequestedTimeout = null

		if (localStreamRequestedTimeoutNotification) {
			localStreamRequestedTimeoutNotification.hideToast()
			localStreamRequestedTimeoutNotification = null
		}

	}

	const clearErrorNotification = function() {
		if (errorNotificationHandle) {
			errorNotificationHandle.hideToast()
			errorNotificationHandle = null
		}
	}

	// In some cases the browser may enter in a faulty state in which
	// "getUserMedia" does not return neither successfully nor with an
	// error. It is not possible to detect this except by guessing when some
	// time passes and the user has not granted nor rejected the media
	// permissions.
	webrtc.on('localStreamRequested', function() {
		clearLocalStreamRequestedTimeoutAndHideNotification()

		localStreamRequestedTimeout = setTimeout(function() {
			// FIXME emit an event and handle it as needed instead of
			// calling UI code from here.
			localStreamRequestedTimeoutNotification = showError(t('spreed', 'This is taking longer than expected. Are the media permissions already granted (or rejected)? If yes please restart your browser, as audio and video are failing'), {
				timeout: TOAST_PERMANENT_TIMEOUT,
			})
		}, 10000)
	})

	signaling.on('leaveRoom', function(token) {
		if (signaling.currentRoomToken === token) {
			clearLocalStreamRequestedTimeoutAndHideNotification()
			clearErrorNotification()
		}
	})

	webrtc.on('localMediaStarted', function(/* configuration */) {
		console.info('localMediaStarted')

		clearLocalStreamRequestedTimeoutAndHideNotification()

		if (signaling.hasFeature('mcu')) {
			checkStartPublishOwnPeer(signaling)
		}
	})

	webrtc.on('localMediaError', function(error) {
		console.warn('Access to microphone & camera failed', error)

		clearLocalStreamRequestedTimeoutAndHideNotification()

		let message
		let timeout = TOAST_PERMANENT_TIMEOUT
		if ((error.name === 'NotSupportedError'
				&& webrtc.capabilities.supportRTCPeerConnection)
			|| (error.name === 'NotAllowedError'
				&& error.message && error.message.indexOf('Only secure origins') !== -1)) {
			message = t('spreed', 'Access to microphone & camera is only possible with HTTPS')
			message += ': ' + t('spreed', 'Please move your setup to HTTPS')
		} else if (error.name === 'NotAllowedError') {
			message = t('spreed', 'Access to microphone & camera was denied')
			timeout = TOAST_DEFAULT_TIMEOUT
		} else if (!webrtc.capabilities.support) {
			console.error('WebRTC not supported')

			message = t('spreed', 'WebRTC is not supported in your browser')
			message += ': ' + t('spreed', 'Please use a different browser like Firefox or Chrome')
		} else {
			// Mostly happens in Chrome (NotFoundError): when no audio device available
			// not sure what else can cause this
			message = t('spreed', 'Error while accessing microphone & camera')
			console.error('Error while accessing microphone & camera: ', error.message, error.name)
		}

		errorNotificationHandle = showError(message, {
			timeout: timeout,
		})
	})

	webrtc.on('channelOpen', function(channel) {
		console.debug('%s datachannel is open', channel.label)
	})

	webrtc.on('channelMessage', function(peer, label, data) {
		if (label === 'status' || label === 'JanusDataChannel') {
			if (data.type === 'audioOn') {
				webrtc.emit('unmute', { id: peer.id, name: 'audio' })
			} else if (data.type === 'audioOff') {
				webrtc.emit('mute', { id: peer.id, name: 'audio' })
			} else if (data.type === 'videoOn') {
				webrtc.emit('unmute', { id: peer.id, name: 'video' })
			} else if (data.type === 'videoOff') {
				webrtc.emit('mute', { id: peer.id, name: 'video' })
			} else if (data.type === 'nickChanged') {
				const name = typeof (data.payload) === 'string' ? data.payload : data.payload.name
				webrtc.emit('nick', { id: peer.id, name: name })
			} else if (data.type === 'speaking' || data.type === 'stoppedSpeaking') {
				// Valid known messages, but handled elsewhere
			} else {
				console.debug('Unknown message type %s from %s datachannel', data.type, label, data)
			}
		} else {
			console.debug('Unknown message from %s datachannel', label, data)
		}
	})

	webrtc.on('speaking', function() {
		sendDataChannelToAll('status', 'speaking')
	})

	webrtc.on('stoppedSpeaking', function() {
		sendDataChannelToAll('status', 'stoppedSpeaking')
	})

	// Send the audio on and off events via data channel
	webrtc.on('audioOn', function() {
		sendDataChannelToAll('status', 'audioOn')
	})
	webrtc.on('audioOff', function() {
		sendDataChannelToAll('status', 'audioOff')
	})
	webrtc.on('videoOn', function() {
		sendDataChannelToAll('status', 'videoOn')
	})
	webrtc.on('videoOff', function() {
		sendDataChannelToAll('status', 'videoOff')
	})

	// Send the nick changed event via data channel and signaling
	//
	// The message format is different in each case. Due to historical reasons
	// the payload of the data channel message is either a string that contains
	// the name (if the participant is a guest) or an object with "name" and
	// "userid" string fields (when the participant is a user).
	//
	// In the newer signaling message, on the other hand, the payload is always
	// an object with only a "name" string field.
	webrtc.on('nickChanged', function(name) {
		let payload
		if (signaling.settings.userId === null) {
			payload = name
		} else {
			payload = {
				'name': name,
				'userid': signaling.settings.userId,
			}
		}

		sendDataChannelToAll('status', 'nickChanged', payload)

		// "webrtc.sendToAll" can not be used, as it only sends the signaling
		// message to participants for which there is a Peer object, so the
		// message may not be sent to participants without audio and video.
		for (const sessionId in usersInCallMapping) {
			if (!usersInCallMapping[sessionId].inCall) {
				continue
			} else if (sessionId === signaling.getSessionId()) {
				continue
			}

			const message = {
				to: sessionId,
				roomType: 'video',
				type: 'nickChanged',
				payload: {
					name: name,
				},
			}
			signaling.emit('message', message)
		}
	})

	// Local screen added.
	webrtc.on('localScreenAdded', function(/* video */) {
		const currentSessionId = signaling.getSessionId()
		for (const sessionId in usersInCallMapping) {
			if (!usersInCallMapping.hasOwnProperty(sessionId)) {
				continue
			} else if (!usersInCallMapping[sessionId].inCall) {
				continue
			} else if (sessionId === currentSessionId) {
				// Running with MCU, no need to create screensharing
				// subscriber for client itself.
				continue
			}

			createScreensharingPeer(signaling, sessionId)
		}
	})

	webrtc.on('localScreenStopped', function() {
		if (!signaling.hasFeature('mcu')) {
			// Only need to notify clients here if running with MCU.
			// Otherwise SimpleWebRTC will notify each client on its own.
			return
		}

		if (ownScreenPeer) {
			ownScreenPeer = null

			localCallParticipantModel.setScreenPeer(ownScreenPeer)

			signaling.sendRoomMessage({
				roomType: 'screen',
				type: 'unshareScreen',
			})
		}
	})

	webrtc.on('disconnected', function() {
		if (ownPeer) {
			webrtc.removePeers(ownPeer.id)
			ownPeer.end()
			ownPeer = null

			localCallParticipantModel.setPeer(ownPeer)
		}

		if (ownScreenPeer) {
			ownScreenPeer.end()
			ownScreenPeer = null

			localCallParticipantModel.setScreenPeer(ownScreenPeer)
		}

		selfInCall = PARTICIPANT.CALL_FLAG.DISCONNECTED

		usersChanged(signaling, [], previousUsersInRoom)
		usersInCallMapping = {}
		previousUsersInRoom = []
	})

	return webrtc
}

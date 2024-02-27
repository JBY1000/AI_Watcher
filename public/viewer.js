const socket = io();
const videoElement = document.getElementById('remoteVideo');
const localVideoElement = document.getElementById('localVideo');
const waitingMessage = document.getElementById('waitingMessage');
let peerConnection;

function setupPeerConnection() {
    peerConnection = new RTCPeerConnection();
    peerConnection.ontrack = event => {
        console.log('Stream received from streamer');
        videoElement.srcObject = event.streams[0];
    };
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            console.log('Sending ICE candidate to streamer');
            socket.emit('receiver-ice-candidate', event.candidate);
        }
    };
    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE Connection State Change:', peerConnection.iceConnectionState);
    };
    peerConnection.onconnectionstatechange = () => {
        console.log('Connection State Change:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
            console.log('Connection lost. Resetting...');
            resetConnection();
        }
    };
}

function resetConnection() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    waitingMessage.style.display = 'block';
}

function setupLocalStream() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(localStream => {
            localVideoElement.srcObject = localStream;
        })
        .catch(error => console.error('Error getting local media:', error));
}

socket.on('offer', offer => {
    console.log('Offer received');
    waitingMessage.style.display = 'none';
    setupPeerConnection();
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => {
            console.log('Creating answer');
            return peerConnection.createAnswer();
        })
        .then(answer => {
            console.log('Setting local description');
            return peerConnection.setLocalDescription(answer);
        })
        .then(() => {
            console.log('Sending answer');
            socket.emit('answer', peerConnection.localDescription);
        })
        .catch(error => console.error('Error in Viewer Setup:', error));
});

setupLocalStream();
socket.on('streamer-ice-candidate', candidate => {
    console.log('Adding received ICE candidate');
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
        .catch(error => console.error('Error adding received ICE candidate:', error));
});

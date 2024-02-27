const socket = io();
let peerConnection;

function setupPeerConnection(stream) {
    peerConnection = new RTCPeerConnection();
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            console.log('Sending ICE candidate to viewer');
            socket.emit('streamer-ice-candidate', event.candidate);
        }
    };
    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE Connection State Change:', peerConnection.iceConnectionState);
    };
    peerConnection.onconnectionstatechange = () => {
        console.log('Connection State Change:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
            console.log('Connection lost. Resetting...');
            resetConnection(stream);
        }
    };
}

function resetConnection(stream) {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    setupStream();
}

function setupStream() {
    // Define media constraints for rear-facing camera
    const constraints = {
        video: { facingMode: { exact: "environment" } }, // Request the rear camera
        audio: true
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            console.log('Stream obtained from rear-facing camera');
            setupPeerConnection(stream);
            return peerConnection.createOffer();
        })
        .then(offer => {
            console.log('Setting local description');
            return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
            console.log('Sending offer to viewer');
            socket.emit('offer', peerConnection.localDescription);
        })
        .catch(error => {
            // Fallback to default camera if the rear camera is not available
            if (error.name === 'OverconstrainedError' || error.name === 'NotFoundError') {
                console.error('Rear-facing camera not available, falling back to default', error);
                navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                    .then(stream => {
                        setupPeerConnection(stream);
                        return peerConnection.createOffer();
                    })
                    .then(offer => peerConnection.setLocalDescription(offer))
                    .then(() => socket.emit('offer', peerConnection.localDescription))
                    .catch(error => console.error('Error in Streamer Setup with default camera:', error));
            } else {
                console.error('Error in Streamer Setup:', error);
            }
        });
}

socket.on('answer', answer => {
    console.log('Setting remote description');
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
        .catch(error => console.error('Error setting remote description:', error));
});

socket.on('receiver-ice-candidate', candidate => {
    console.log('Adding received ICE candidate');
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
        .catch(error => console.error('Error adding received ICE candidate:', error));
});

setupStream();

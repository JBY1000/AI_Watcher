const socket = io();
const videoElement = document.getElementById('remoteVideo');
const localVideoElement = document.getElementById('localVideo');
const waitingMessage = document.getElementById('waitingMessage');
let peerConnection;
let model;

// Global variables for the canvas and its context
let canvas, ctx;


// Load Coco SSD model
async function loadModel() {
    model = await cocoSsd.load();
    console.log('Coco SSD model loaded');
}
function setupCanvas() {
    canvas = document.createElement('canvas');
    document.getElementById('sidebar').appendChild(canvas); // Append canvas to the sidebar
    ctx = canvas.getContext('2d');

    // Set up the canvas to overlay the video
    canvas.width = localVideoElement.offsetWidth;
    canvas.height = localVideoElement.offsetHeight;
    canvas.style.position = 'absolute';
    canvas.style.left = localVideoElement.offsetLeft + 'px';
    canvas.style.top = localVideoElement.offsetTop + 'px';
}

async function detectObjects() {
    if (localVideoElement.readyState >= 2 && model) {
        const predictions = await model.detect(localVideoElement);
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear previous drawings

        // Calculate scaling factors
        const scaleX = localVideoElement.offsetWidth / localVideoElement.videoWidth;
        const scaleY = localVideoElement.offsetHeight / localVideoElement.videoHeight;

        predictions.forEach(prediction => {
            // Apply scaling to the bounding box coordinates and dimensions
            const [x, y, width, height] = prediction.bbox;
            const scaledX = x * scaleX;
            const scaledY = y * scaleY;
            const scaledWidth = width * scaleX;
            const scaledHeight = height * scaleY;

            ctx.strokeStyle = 'red';
            ctx.lineWidth = 4;
            ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
            ctx.fillStyle = 'red';
            ctx.fillText(prediction.class + ' ' + Math.round(prediction.score * 100) / 100, scaledX, scaledY);
        });
    }
    requestAnimationFrame(detectObjects);
}



// Initialize the canvas when the local video stream is ready
localVideoElement.onloadedmetadata = () => {
    setupCanvas();
    detectObjects();
};

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
            loadModel().then(() => {
                detectObjects();
            });
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

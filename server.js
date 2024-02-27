const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public')); // Serve static files from 'public' directory

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('offer', (offer) => {
        socket.broadcast.emit('offer', offer);
    });

    socket.on('answer', (answer) => {
        socket.broadcast.emit('answer', answer);
    });

    socket.on('streamer-ice-candidate', (candidate) => {
        socket.broadcast.emit('streamer-ice-candidate', candidate);
    });

    socket.on('receiver-ice-candidate', (candidate) => {
        socket.broadcast.emit('receiver-ice-candidate', candidate);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(3000, () => {
    console.log('Server listening on port 3000');
});

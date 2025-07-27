const express = require('express');
const socket = require('socket.io');
const http = require('http');
const path = require('path');
const { Chess } = require('chess.js');

const app = express();

const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();
let players = { white: null, black: null };
let currentPlayer = 'w';

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index', { title: "Let's Play Chess" });
});

io.on('connection', (uniquesocket) => {
    console.log('Connected:', uniquesocket.id);

    // Assign roles
    if (!players.white) {
        players.white = uniquesocket.id;
        uniquesocket.emit('playerRole', 'w');
    } else if (!players.black) {
        players.black = uniquesocket.id;
        uniquesocket.emit('playerRole', 'b');
    } else {
        uniquesocket.emit('spectatorRole');
    }

    // Send current board state to everyone who connects
    uniquesocket.emit('boardState', chess.fen());

    uniquesocket.on('disconnect', () => {
        console.log('Disconnected:', uniquesocket.id);
        if (players.white === uniquesocket.id) {
            players.white = null;
        } else if (players.black === uniquesocket.id) {
            players.black = null;
        }
    });

    uniquesocket.on('move', (move) => {
        try {
            // Enforce turn by role
            if (chess.turn() === 'w' && uniquesocket.id !== players.white) {
                return;
            }
            if (chess.turn() === 'b' && uniquesocket.id !== players.black) {
                return;
            }

            const result = chess.move(move);
            if (result) {
                currentPlayer = chess.turn();
                io.emit('move', move);
                io.emit('boardState', chess.fen());
            } else {
                console.log('Invalid move:', move);
                uniquesocket.emit('invalidMove', move);
            }
        } catch (err) {
            console.error(err);
            uniquesocket.emit('invalidMove', move);
        }
    });
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});

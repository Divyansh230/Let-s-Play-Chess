const express = require('express');
const socket = require('socket.io');
const http = require('http');
const path = require('path');
const { Chess } = require('chess.js');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');

// User model
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const app = express();

const server = http.createServer(app);
const io = socket(server);

// Session middleware (move this above all routes)
app.use(session({
    secret: 'chess_secret_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/chessapp' }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

const chess = new Chess();
let players = { white: null, black: null };
let currentPlayer = 'w';

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Auth middleware
function ensureAuthenticated(req, res, next) {
    if (req.session.userId) return next();
    res.redirect('/login');
}

// Signup route
app.get('/signup', (req, res) => {
    res.render('signup', { title: 'Sign Up', error: null });
});
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.render('signup', { title: 'Sign Up', error: 'All fields required.' });
    }
    try {
        const existing = await User.findOne({ username });
        if (existing) {
            return res.render('signup', { title: 'Sign Up', error: 'Username already exists.' });
        }
        const hash = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hash });
        await user.save();
        req.session.userId = user._id;
        res.redirect('/');
    } catch (err) {
        res.render('signup', { title: 'Sign Up', error: 'Error creating user.' });
    }
});

// Login route
app.get('/login', (req, res) => {
    res.render('login', { title: 'Login', error: null });
});
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.render('login', { title: 'Login', error: 'All fields required.' });
    }
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.render('login', { title: 'Login', error: 'Invalid credentials.' });
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.render('login', { title: 'Login', error: 'Invalid credentials.' });
        }
        req.session.userId = user._id;
        res.redirect('/');
    } catch (err) {
        res.render('login', { title: 'Login', error: 'Error logging in.' });
    }
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// Protect chess game route
app.get('/', ensureAuthenticated, (req, res) => {
    res.render('index', { title: "Let's Play Chess" });
});

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/chessapp', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));


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

server.listen(5002, () => {
    console.log('Server is running on http://localhost:5002');
});

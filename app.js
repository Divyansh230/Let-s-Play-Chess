const express=require('express');
const socket=require('socket.io');
const http=require('http');
const path=require('path');
const {Chess}= require('chess.js');


const app=express();


const server=http.createServer(app);
const io=socket(server);

const chess=new Chess();
let players={};
let currentPlayer="W";

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index',{title: 'Let\'s Play Chess'});
});

io.on('connection',(uniquesocket)=>{
    console.log("Connected");
    
})

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});


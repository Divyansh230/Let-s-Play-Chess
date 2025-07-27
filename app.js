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
   console.log('Connected');
   if(!players.white){
    players.white=uniquesocket.id;
    uniquesocket.emit('playerRole', 'w');
   }
   else if(!players.black){
    players.black=uniquesocket.id;
    uniquesocket.emit('playerRole', 'b');
   }
   else{
    uniquesocket.emit('spectatorRole')
   }
   uniquesocket.on('disconnect',()=>{
    if(socket.id===players.white){
        delete players.white;
    }
    else if(socket.id===players.black){
        delete players.black;
    }
   });

   uniquesocket.on('move',(move)=>{
    try{
        if(chess.turn()==='w' && uniquesocket.id!==players.white){
            return;
        }
        if(chess.turn()==='b' && uniquesocket.id!==players.black){
            return;
        }

        const result=chess.move(move);
        if(result){
            currentPlayer=chess.turn();
            io.emit('move',move);
            io.emit("boardState",chess.fen())
        }
        else{
            console.log("Invalid move:",move);
            uniquesocket.emit("invalidMove",move);
            
        }

    }
    catch(err){
        console.log(err);
        uniquesocket.emit("Invalid move:",move);
    }
   })


}
)

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});


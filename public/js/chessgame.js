const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let highlightedSquares = [];

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = ""; // Reset board

    board.forEach((row, rowIndex) => {
        row.forEach((square, squareindex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add(
                "square",
                (rowIndex + squareindex) % 2 === 0 ? "light" : "dark"
            );

            squareElement.dataset.row = rowIndex;
            squareElement.dataset.col = squareindex;

            // Highlight valid moves
            if (highlightedSquares.some(sq => sq.row === rowIndex && sq.col === squareindex)) {
                squareElement.classList.add("highlight-move");
            }

            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add(
                    "piece",
                    square.color === "w" ? "white" : "black"
                );

                // Display Unicode character for the piece
                pieceElement.innerText = getPieceUnicode(square);

                pieceElement.draggable = playerRole === square.color;
                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowIndex, col: squareindex };
                        e.dataTransfer.setData("text/plain", "");
                        highlightMoves(rowIndex, squareindex);
                    }
                });
                pieceElement.addEventListener("dragend", (e) => {
                    draggedPiece = null;
                    sourceSquare = null;
                    clearHighlights();
                });
                pieceElement.addEventListener("click", (e) => {
                    if (playerRole === square.color) {
                        if (highlightedSquares.length && sourceSquare && sourceSquare.row === rowIndex && sourceSquare.col === squareindex) {
                            // Deselect if clicking the same piece
                            clearHighlights();
                            sourceSquare = null;
                        } else {
                            sourceSquare = { row: rowIndex, col: squareindex };
                            highlightMoves(rowIndex, squareindex);
                        }
                    }
                });

                squareElement.appendChild(pieceElement);
            }

            // Drag and drop events for each square
            squareElement.addEventListener("dragover", (e) => {
                e.preventDefault();
            });

            squareElement.addEventListener("drop", (e) => {
                e.preventDefault();
                if (draggedPiece) {
                    const targetSource = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col)
                    };
                    handleMove(sourceSquare, targetSource);
                    clearHighlights();
                }
            });

            squareElement.addEventListener("click", (e) => {
                if (highlightedSquares.length && sourceSquare) {
                    const target = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col)
                    };
                    // If clicked square is a valid move
                    if (highlightedSquares.some(sq => sq.row === target.row && sq.col === target.col)) {
                        handleMove(sourceSquare, target);
                        clearHighlights();
                    }
                }
            });

            boardElement.appendChild(squareElement);
        });
    });
    if(playerRole==='b'){
        boardElement.classList.add('flipped');
    }
    else{
        boardElement.classList.remove('flipped');
    }
};



const handleMove = (source, target) => {
    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion: "q"
    };

    const result = chess.move(move);
    if (result) {
        socket.emit("move", move);
        renderBoard();
    }
};

function highlightMoves(row, col) {
    highlightedSquares = [];
    const from = `${String.fromCharCode(97 + col)}${8 - row}`;
    const moves = chess.moves({ square: from, verbose: true });
    highlightedSquares = moves.map(move => {
        const targetCol = move.to.charCodeAt(0) - 97;
        const targetRow = 8 - parseInt(move.to[1]);
        return { row: targetRow, col: targetCol };
    });
    renderBoard();
}

function clearHighlights() {
    highlightedSquares = [];
    renderBoard();
}

const getPieceUnicode = (piece) => {
    const unicodePiece = {
        p: { w: "♙", b: "♟" },
        r: { w: "♖", b: "♜" },
        n: { w: "♘", b: "♞" },
        b: { w: "♗", b: "♝" },
        q: { w: "♕", b: "♛" },
        k: { w: "♔", b: "♚" }
    };
    return unicodePiece[piece.type]?.[piece.color] || "";
};

// Socket events
socket.on("playerRole", (role) => {
    playerRole = role;
    clearHighlights();
});

socket.on("spectatorRole", () => {
    playerRole = null;
    clearHighlights();
});

socket.on("boardState", (fen) => {
    chess.load(fen);
    clearHighlights();
});

socket.on("move", (move) => {
    chess.move(move);
    clearHighlights();
});

// Initial render
renderBoard();

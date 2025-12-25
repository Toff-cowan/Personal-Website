let boardSquaresArray = [];
let moves = [];
const castlingSquares = ["g1", "g8", "c1", "c8"];
let isWhiteTurn = true;
const boardSquares = document.getElementsByClassName("square");

/* ---------- Mobile touch support ---------- */
let touchStartSquare = null;
let touchStartTime = 0;
let isDragging = false;
let draggedPiece = null;
let draggedPieceElement = null;
let dragOffset = { x: 0, y: 0 };
let currentTouchSquare = null;

const boardElement = document.getElementById("board");
const promotionBox = document.getElementById("promotion-box");
const promotionOptions = document.getElementById("promotion-options");

/* ---------- Timer state ---------- */
let whiteTime = 300;
let blackTime = 300;
let activeColor = "white";
let timerInterval = null;
let isRunning = false;

/* ---------- Captured pieces ---------- */
let capturedByWhite = [];
let capturedByBlack = [];

/* ---------- DOM controls (menu) ---------- */
const whiteTimerEl = document.getElementById("white-timer");
const blackTimerEl = document.getElementById("black-timer");
//const startBtn = document.getElementById("startBtn");
const timeSelect = document.getElementById("timeSelect");
const newGameBtn = document.getElementById("newGameBtn");
const loadingSpinner = document.getElementById("loadingSpinner");
const prevMoveText = document.getElementById("prevMoveText");

/* ---------- New DOM elements for side captures and move list ---------- */
const capturedByWhiteEl = document.getElementById("capturedByWhite");
const capturedByBlackEl = document.getElementById("capturedByBlack");
const moveList = document.getElementById("moveList");

/* ---------- Game state extras ---------- */
let enPassantTarget = "blank";
let halfmoveClock = 0;
let positionHistory = [];
let selectedPiece = null;
let legalMoves = [];
let currentViewIndex = -1; // -1 means viewing current position
let isViewingHistory = false;
let drawOfferFrom = null; // 'white', 'black', or null
let drawAcceptedBy = null; // 'white', 'black', or null

/* ---------- Utility: get image URL for a piece type/color ---------- */
function getImageForPiece(pieceColor, pieceType) {
  // First try to find an existing piece image on the page
  const candidates = Array.from(document.querySelectorAll('.piece'));
  for (let p of candidates) {
    const c = p.getAttribute('color');
    const t = p.classList[1];
    const img = p.querySelector('img');
    if (img && c === pieceColor && t === pieceType) return img.src;
  }
  return `chesspieces/${pieceColor.charAt(0).toUpperCase() + pieceColor.slice(1)}-${pieceType.charAt(0).toUpperCase() + pieceType.slice(1)}.png`;
}

/* ---------- BOARD / PIECE SETUP ---------- */
function setupBoardSquares() {
  for (let i = 0; i < boardSquares.length; i++) {
    boardSquares[i].addEventListener("dragover", allowDrop);
    boardSquares[i].addEventListener("drop", drop);
    boardSquares[i].addEventListener("click", handleSquareClick);
    // Mobile touch support
    boardSquares[i].addEventListener("touchstart", handleTouchStart, { passive: false });
    boardSquares[i].addEventListener("touchend", handleTouchEnd, { passive: false });
    boardSquares[i].addEventListener("touchmove", handleTouchMove, { passive: false });
    let row = 8 - Math.floor(i / 8);
    let column = String.fromCharCode(97 + (i % 8));
    boardSquares[i].id = column + row;
  }
}

function setupPieces() {
  const pieces = document.getElementsByClassName("piece");
  const piecesImages = document.getElementsByTagName("img");
  for (let i = 0; i < pieces.length; i++) {
    // Enable drag functionality
    pieces[i].setAttribute("draggable", true);
    pieces[i].addEventListener("dragstart", drag);
    pieces[i].addEventListener("dragend", function(ev) {
      clearMoveDots();
      // Remove visual feedback
      ev.target.closest('.piece')?.classList.remove('moving');
    });
    // Enable click functionality
    pieces[i].addEventListener("click", handlePieceClick);
    // Add touch support for pieces
    pieces[i].addEventListener("touchstart", handlePieceTouch, { passive: false });
    if (!pieces[i].id) {
      const type = pieces[i].classList[1] || "piece";
      const parent = pieces[i].parentElement;
      pieces[i].id = type + (parent ? parent.id : "");
    }
  }
  for (let i = 0; i < piecesImages.length; i++) {
    piecesImages[i].setAttribute("draggable", false);
  }
}

/* ---------- Mobile touch support for pieces ---------- */
let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;
const TOUCH_MOVE_THRESHOLD = 10; // pixels

function handlePieceTouch(event) {
  const piece = event.currentTarget;
  const pieceColor = piece.getAttribute("color");
  
  // Only allow interaction if it's the player's turn
  if ((isWhiteTurn && pieceColor === "white") || (!isWhiteTurn && pieceColor === "black")) {
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchMoved = false;
    
    const square = piece.parentElement;
    const pieceRect = piece.getBoundingClientRect();
    
    // Calculate offset from touch point to piece center
    dragOffset.x = touch.clientX - (pieceRect.left + pieceRect.width / 2);
    dragOffset.y = touch.clientY - (pieceRect.top + pieceRect.height / 2);
    
    draggedPiece = {
      pieceId: piece.id,
      squareId: square.id,
      pieceColor: pieceColor,
      pieceType: piece.classList[1]
    };
    draggedPieceElement = piece;
    
    // Select the piece and show legal moves (for tap-to-move)
    handlePieceClick({ currentTarget: piece, stopPropagation: () => {} });
    
    // Add global touch move and end listeners
    document.addEventListener('touchmove', handlePieceTouchMove, { passive: false });
    document.addEventListener('touchend', handlePieceTouchEnd, { passive: false });
  }
}

function handlePieceTouchMove(event) {
  if (draggedPiece && draggedPieceElement && event.touches.length > 0) {
    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);
    
    // Check if user has moved enough to start dragging
    if (deltaX > TOUCH_MOVE_THRESHOLD || deltaY > TOUCH_MOVE_THRESHOLD) {
      if (!touchMoved) {
        // Start dragging
        touchMoved = true;
        event.preventDefault();
        event.stopPropagation();
        
        // Make piece follow touch
        draggedPieceElement.style.position = 'fixed';
        draggedPieceElement.style.zIndex = '10000';
        draggedPieceElement.style.pointerEvents = 'none';
        draggedPieceElement.style.transform = 'scale(1.1)';
        draggedPieceElement.style.transition = 'none';
        
        // Prevent page scrolling while dragging
        document.body.style.overflow = 'hidden';
      }
      
      // Update position
      updateDraggedPiecePosition(touch.clientX, touch.clientY);
      event.preventDefault();
    } else {
      // Not enough movement - allow page scrolling
      return;
    }
  }
}

function handlePieceTouchEnd(event) {
  if (draggedPiece && draggedPieceElement) {
    // Re-enable page scrolling
    document.body.style.overflow = '';
    
    if (touchMoved) {
      // User was dragging - handle as drag end
      handlePieceDragEnd(event);
    } else {
      // User just tapped - tap-to-move is already handled by handlePieceClick
      // Just clean up
      touchMoved = false;
      draggedPiece = null;
      draggedPieceElement = null;
      dragOffset = { x: 0, y: 0 };
      currentTouchSquare = null;
    }
    
    // Remove global listeners
    document.removeEventListener('touchmove', handlePieceTouchMove);
    document.removeEventListener('touchend', handlePieceTouchEnd);
  }
}

function updateDraggedPiecePosition(x, y) {
  if (draggedPieceElement) {
    draggedPieceElement.style.left = (x - dragOffset.x) + 'px';
    draggedPieceElement.style.top = (y - dragOffset.y) + 'px';
    
    // Clear all square highlights first
    document.querySelectorAll('.square').forEach(sq => {
      if (!sq.classList.contains('last-move')) {
        sq.style.backgroundColor = '';
      }
    });
    
    // Find which square we're over
    const elementBelow = document.elementFromPoint(x, y);
    const squareBelow = elementBelow?.closest('.square');
    if (squareBelow && squareBelow.id) {
      const newSquareId = squareBelow.id;
      currentTouchSquare = newSquareId;
      
      // Highlight if it's a legal move
      if (legalMoves.includes(newSquareId)) {
        squareBelow.style.backgroundColor = 'rgba(59, 130, 246, 0.5)';
      } else if (newSquareId !== draggedPiece.squareId) {
        // Highlight invalid moves in red
        squareBelow.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
      }
    }
  }
}

function handlePieceDragMove(event) {
  if (draggedPiece && draggedPieceElement && event.touches.length > 0) {
    event.preventDefault();
    const touch = event.touches[0];
    updateDraggedPiecePosition(touch.clientX, touch.clientY);
  }
}

function handlePieceDragEnd(event) {
  if (draggedPiece && draggedPieceElement) {
    event.preventDefault();
    
    // Re-enable page scrolling
    document.body.style.overflow = '';
    
    const originalSquare = document.getElementById(draggedPiece.squareId);
    let moveExecuted = false;
    
    // Check if dropped on a legal square
    if (currentTouchSquare && legalMoves.includes(currentTouchSquare)) {
      const piece = document.getElementById(draggedPiece.pieceId);
      if (piece) {
        executeMove(draggedPiece.squareId, currentTouchSquare, piece);
        moveExecuted = true;
      }
    }
    
    // Always reset piece styling and position
    if (originalSquare && draggedPieceElement) {
      // Store the piece element reference
      const pieceToReset = draggedPieceElement;
      
      // If move was not executed, return piece to original position
      if (!moveExecuted) {
        // Return piece to original position with animation
        pieceToReset.style.transition = 'all 0.3s ease';
        const originalRect = originalSquare.getBoundingClientRect();
        const boardRect = boardElement.getBoundingClientRect();
        
        // Calculate position relative to the board
        const relativeLeft = originalRect.left - boardRect.left + (originalRect.width / 2) - (pieceToReset.offsetWidth / 2);
        const relativeTop = originalRect.top - boardRect.top + (originalRect.height / 2) - (pieceToReset.offsetHeight / 2);
        
        pieceToReset.style.left = originalRect.left + (originalRect.width / 2) - (pieceToReset.offsetWidth / 2) + 'px';
        pieceToReset.style.top = originalRect.top + (originalRect.height / 2) - (pieceToReset.offsetHeight / 2) + 'px';
        
        // After animation, reset all styles and ensure piece is back in its square
        setTimeout(() => {
          // Reset all inline styles
          pieceToReset.style.position = '';
          pieceToReset.style.zIndex = '';
          pieceToReset.style.pointerEvents = '';
          pieceToReset.style.transform = '';
          pieceToReset.style.transition = '';
          pieceToReset.style.left = '';
          pieceToReset.style.top = '';
          
          // Ensure the piece is still in the correct square (in case DOM was modified)
          if (originalSquare && !originalSquare.contains(pieceToReset)) {
            // Piece might have been moved, but we need to ensure it's visually correct
            // The piece should already be in the square from the original setup
          }
        }, 300);
      } else {
        // Move was executed - immediately reset styles
        pieceToReset.style.position = '';
        pieceToReset.style.zIndex = '';
        pieceToReset.style.pointerEvents = '';
        pieceToReset.style.transform = '';
        pieceToReset.style.transition = '';
        pieceToReset.style.left = '';
        pieceToReset.style.top = '';
      }
    }
    
    // Clear square highlights
    document.querySelectorAll('.square').forEach(sq => {
      if (!sq.classList.contains('last-move')) {
        sq.style.backgroundColor = '';
      }
    });
    
    clearSelection();
    
    // Reset drag state
    touchMoved = false;
    draggedPiece = null;
    draggedPieceElement = null;
    currentTouchSquare = null;
    dragOffset = { x: 0, y: 0 };
  }
}

/* ---------- Board array filling ---------- */
function fillBoardSquaresArray() {
  boardSquaresArray = [];
  for (let i = 0; i < boardSquares.length; i++) {
    let row = 8 - Math.floor(i / 8);
    let column = String.fromCharCode(97 + (i % 8));
    let square = boardSquares[i];
    square.id = column + row;

    if (square.querySelector(".piece")) {
      let pieceEl = square.querySelector(".piece");
      let color = pieceEl.getAttribute("color");
      let pieceType = pieceEl.classList[1] || "pawn";
      let pieceId = pieceEl.id || (pieceType + square.id);
      boardSquaresArray.push({ squareId: square.id, pieceColor: color, pieceType: pieceType, pieceId: pieceId });
    } else {
      boardSquaresArray.push({ squareId: square.id, pieceColor: "blank", pieceType: "blank", pieceId: "blank" });
    }
  }
  positionHistory = [getPositionSignature(boardSquaresArray)];
}

/* ---------- Helper: deep copy ---------- */
function deepCopyArray(array) {
  return array.map(el => ({ ...el }));
}

/* ---------- MOVE DOTS VISUALIZATION ---------- */
function showMoveDots(legalSquares, startingSquareId) {
  clearMoveDots();
  
  legalSquares.forEach(squareId => {
    const square = document.getElementById(squareId);
    if (square) {
      const dot = document.createElement('div');
      const targetPiece = getPieceAtSquare(squareId, boardSquaresArray);
      
      if (targetPiece.pieceColor !== "blank" && targetPiece.pieceColor !== getPieceAtSquare(startingSquareId, boardSquaresArray).pieceColor) {
        // Capture move - show circle
        dot.className = 'move-dot capture';
      } else {
        // Normal move - show dot
        dot.className = 'move-dot';
      }
      
      square.appendChild(dot);
    }
  });
}

function clearMoveDots() {
  const dots = document.querySelectorAll('.move-dot');
  dots.forEach(dot => dot.remove());
}

/* ---------- CLICK HANDLERS ---------- */
function handlePieceClick(event) {
  event.stopPropagation();
  
  // Don't allow moves when viewing history
  if (isViewingHistory) {
    return;
  }
  
  const piece = event.currentTarget;
  const pieceColor = piece.getAttribute("color");
  
  if ((isWhiteTurn && pieceColor === "white") || (!isWhiteTurn && pieceColor === "black")) {
    const startingSquareId = piece.parentNode.id;
    selectPiece(startingSquareId, piece);
  }
}

function handleSquareClick(event) {
  const square = event.currentTarget;
  const squareId = square.id;
  
  if (selectedPiece && legalMoves.includes(squareId)) {
    // Execute the move
    const piece = document.getElementById(selectedPiece.pieceId);
    executeMove(selectedPiece.squareId, squareId, piece);
  }
  
  clearSelection();
}

function selectPiece(squareId, piece) {
  clearSelection();
  
  selectedPiece = {
    squareId: squareId,
    pieceId: piece.id,
    pieceColor: piece.getAttribute("color"),
    pieceType: piece.classList[1]
  };
  
  // Add visual selection
  piece.classList.add('moving');
  
  // Show legal moves
  const pieceObj = {
    pieceColor: selectedPiece.pieceColor,
    pieceType: selectedPiece.pieceType
  };
  
  legalMoves = getPossibleMoves(squareId, pieceObj, boardSquaresArray);
  legalMoves = isMoveValidAgainstCheck(legalMoves, squareId, selectedPiece.pieceColor, selectedPiece.pieceType);
  
  showMoveDots(legalMoves, squareId);
}

function clearSelection() {
  if (selectedPiece) {
    const piece = document.getElementById(selectedPiece.pieceId);
    if (piece) {
      piece.classList.remove('moving');
    }
  }
  
  selectedPiece = null;
  legalMoves = [];
  clearMoveDots();
}

/* ---------- Prevent capturing kings ---------- */
function executeMove(fromId, toId, piece) {
  const pieceColor = piece.getAttribute("color");
  const pieceType = piece.classList[1];
  const targetSquare = document.getElementById(toId);
  const targetPiece = getPieceAtSquare(toId, boardSquaresArray);
  
  // Prevent capturing kings
  if (targetPiece.pieceType === "king") {
    console.log("Cannot capture the king!");
    flashRed(toId);
    clearSelection();
    return;
  }
  
  // Handle captures
  if (targetPiece.pieceColor !== "blank" && targetPiece.pieceColor !== pieceColor) {
    removePieceFromSquare(targetSquare);
    recordCapturedPiece(pieceColor, targetPiece.pieceType);
  }
  
  // Move the piece
  targetSquare.appendChild(piece);
  
  // Update game state
  updateBoardSquaresArray(fromId, toId, boardSquaresArray);
  isWhiteTurn = !isWhiteTurn;
  
  // Switch active timer color
  setActiveColorFromTurn();
  
  // Record the move
  makeMove(fromId, toId, pieceType, pieceColor, targetPiece.pieceColor !== "blank");
  
  // Handle special moves
  if (pieceType === "pawn") {
    maybePromotePawn(toId, pieceColor, piece);
  }
  
  // Start timer if not already running
  if (!isRunning) {
    startGameTimer();
  }
  
  // Update UI and check game state
  pushPositionAndCheckDraws();
  checkForCheckMate();
}

/* ---------- Move recording ---------- */
function makeMove(startingSquareId, destinationSquareId, pieceType, pieceColor, captured, extra = {}) {
  // If viewing history, return to current position first
  if (isViewingHistory && currentViewIndex < moves.length - 1) {
    // Restore to latest position
    currentViewIndex = moves.length - 1;
    restorePositionToView(currentViewIndex);
  }
  
  // Clear draw offer when a move is made
  if (drawOfferFrom !== null) {
    drawOfferFrom = null;
    drawAcceptedBy = null;
    if (drawBtn) {
      drawBtn.textContent = "Offer Draw";
      drawBtn.classList.remove('draw-offered');
    }
    const drawBtnMobile = document.getElementById('drawBtnMobile');
    if (drawBtnMobile) {
      drawBtnMobile.classList.remove('draw-offered');
    }
    // Hide mobile draw confirmation
    const mobileDrawConfirm = document.getElementById('mobileDrawConfirm');
    if (mobileDrawConfirm) {
      mobileDrawConfirm.classList.remove('show');
    }
  }
  
  moves.push({
    from: startingSquareId,
    to: destinationSquareId,
    pieceType,
    pieceColor,
    captured,
    ...extra
  });
  
  currentViewIndex = moves.length - 1; // Update to latest move
  isViewingHistory = false;
  
  if (pieceType === "pawn" || captured) halfmoveClock = 0;
  else halfmoveClock++;
  updatePreviousMoveUI(moves[moves.length - 1]);
  updateMoveList();
  updateNavigationButtons();
  saveGameState();
}

/* ---------- Update internal board state array ---------- */
function updateBoardSquaresArray(currentSquareId, destinationSquareId, boardArr) {
  let current = boardArr.find(e => e.squareId === currentSquareId);
  let dest = boardArr.find(e => e.squareId === destinationSquareId);
  if (!current || !dest) return;
  dest.pieceColor = current.pieceColor;
  dest.pieceType = current.pieceType;
  dest.pieceId = current.pieceId;
  current.pieceColor = "blank";
  current.pieceType = "blank";
  current.pieceId = "blank";
}

/* ---------- Drag/drop handlers ---------- */
function allowDrop(ev) { ev.preventDefault(); }

function drag(ev) {
  const piece = ev.target.closest('.piece');
  if (!piece) {
    ev.preventDefault();
    return;
  }
  
  const pieceColor = piece.getAttribute("color");
  const pieceType = piece.classList[1];
  if ((isWhiteTurn && pieceColor == "white") || (!isWhiteTurn && pieceColor == "black")) {
    const startingSquareId = piece.parentNode.id;
    ev.dataTransfer.setData("text", piece.id + "|" + startingSquareId);
    ev.dataTransfer.effectAllowed = "move";
    
    // Create a drag image that matches the piece size
    const pieceRect = piece.getBoundingClientRect();
    const dragImage = piece.cloneNode(true);
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.left = '-1000px';
    dragImage.style.width = pieceRect.width + 'px';
    dragImage.style.height = pieceRect.height + 'px';
    dragImage.style.opacity = '0.8';
    dragImage.style.pointerEvents = 'none';
    dragImage.style.transform = 'scale(1.1)';
    document.body.appendChild(dragImage);
    
    // Calculate offset to center the drag image on cursor
    const offsetX = pieceRect.width / 2;
    const offsetY = pieceRect.height / 2;
    ev.dataTransfer.setDragImage(dragImage, offsetX, offsetY);
    
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage);
      }
    }, 0);
    
    const pieceObject = { pieceColor, pieceType, pieceId: piece.id };
    let legalSquares = getPossibleMoves(startingSquareId, pieceObject, boardSquaresArray);
    legalSquares = isMoveValidAgainstCheck(legalSquares, startingSquareId, pieceColor, pieceType);
    ev.dataTransfer.setData("application/json", JSON.stringify(legalSquares));
    
    // Show move dots during drag
    showMoveDots(legalSquares, startingSquareId);
    
    // Add visual feedback
    piece.classList.add('moving');
  } else {
    ev.preventDefault();
  }
}

function drop(ev) {
  ev.preventDefault();
  clearMoveDots();
  
  let data = ev.dataTransfer.getData("text");
  if (!data) return;
  let [pieceId, startingSquareId] = data.split("|");
  let legalSquaresJson = ev.dataTransfer.getData("application/json") || "[]";
  let legalSquares = JSON.parse(legalSquaresJson);

  const piece = document.getElementById(pieceId);
  if (!piece) return;

  const pieceColor = piece.getAttribute("color");
  const pieceType = piece.classList[1];
  const destinationSquare = ev.currentTarget;
  let destinationSquareId = destinationSquare.id;

  legalSquares = isMoveValidAgainstCheck(legalSquares, startingSquareId, pieceColor, pieceType);

  if (pieceType == "king") {
    if (isKingInCheck(destinationSquareId, pieceColor, boardSquaresArray)) return;
  }

  let squareContent = getPieceAtSquare(destinationSquareId, boardSquaresArray);

  // EN PASSANT
  if (pieceType === "pawn" && destinationSquareId === enPassantTarget) {
    if (legalSquares.includes(destinationSquareId)) {
      const destFile = destinationSquareId.charAt(0);
      let capturedPawnRank = isWhiteTurn ? parseInt(destinationSquareId.charAt(1)) - 1 : parseInt(destinationSquareId.charAt(1)) + 1;
      let capturedPawnSquareId = destFile + capturedPawnRank;
      let capturedPawnSquare = document.getElementById(capturedPawnSquareId);
      if (capturedPawnSquare) {
        removePieceFromSquare(capturedPawnSquare);
        destinationSquare.appendChild(piece);
        updateBoardSquaresArray(startingSquareId, destinationSquareId, boardSquaresArray);
        let capturedEl = boardSquaresArray.find(el => el.squareId === capturedPawnSquareId);
        if (capturedEl) { capturedEl.pieceColor = "blank"; capturedEl.pieceType = "blank"; capturedEl.pieceId = "blank"; }
        recordCapturedPiece(pieceColor === "white" ? 'black' : 'white', 'pawn');
        isWhiteTurn = !isWhiteTurn;
        setActiveColorFromTurn();
        makeMove(startingSquareId, destinationSquareId, pieceType, pieceColor, true, { enPassant: true });
        enPassantTarget = "blank";
        maybePromotePawn(destinationSquareId, pieceColor, piece);
        pushPositionAndCheckDraws();
        checkForCheckMate();
        return;
      }
    } else {
      flashRed(destinationSquareId);
      return;
    }
  }

  // NORMAL MOVE TO EMPTY SQUARE
  if (squareContent.pieceColor == "blank" && legalSquares.includes(destinationSquareId)) {
    if (pieceType == "king" && !kingHasMoved(pieceColor) && castlingSquares.includes(destinationSquareId) &&
        !isKingInCheck(startingSquareId, pieceColor, boardSquaresArray)) {
      performCastling(piece, pieceColor, startingSquareId, destinationSquareId, boardSquaresArray);
      setActiveColorFromTurn();
      return;
    }

    destinationSquare.appendChild(piece);

    let captured = false;
    updateBoardSquaresArray(startingSquareId, destinationSquareId, boardSquaresArray);

    if (pieceType === "pawn") {
      const startRank = parseInt(startingSquareId.charAt(1));
      const destRank = parseInt(destinationSquareId.charAt(1));
      if (Math.abs(destRank - startRank) === 2) {
        const passedRank = (startRank + destRank) / 2;
        enPassantTarget = destinationSquareId.charAt(0) + passedRank;
      } else enPassantTarget = "blank";
    } else enPassantTarget = "blank";

    isWhiteTurn = !isWhiteTurn;
    setActiveColorFromTurn();
    makeMove(startingSquareId, destinationSquareId, pieceType, pieceColor, captured);
    if (pieceType === "pawn") maybePromotePawn(destinationSquareId, pieceColor, piece);
    pushPositionAndCheckDraws();
    checkForCheckMate();
    return;
  }

  // CAPTURE
  if (squareContent.pieceColor != "blank" && legalSquares.includes(destinationSquareId)) {
    const capturedPieceType = squareContent.pieceType;
    const capturedPieceColor = squareContent.pieceColor;
    removePieceFromSquare(destinationSquare);

    destinationSquare.appendChild(piece);
    isWhiteTurn = !isWhiteTurn;
    setActiveColorFromTurn();

    updateBoardSquaresArray(startingSquareId, destinationSquareId, boardSquaresArray);
    enPassantTarget = "blank";
    recordCapturedPiece(pieceColor === "white" ? 'black' : 'white', capturedPieceType);
    makeMove(startingSquareId, destinationSquareId, pieceType, pieceColor, true);
    if (pieceType === "pawn") maybePromotePawn(destinationSquareId, pieceColor, piece);
    pushPositionAndCheckDraws();
    checkForCheckMate();
    return;
  }

  flashRed(destinationSquareId);
}

/* ---------- Helper to remove a piece element ---------- */
function removePieceFromSquare(squareEl) {
  const children = Array.from(squareEl.children);
  for (let child of children) {
    if (!child.classList.contains('coordinate')) {
      squareEl.removeChild(child);
    }
  }
}

/* ---------- Captured pieces tracking ---------- */
function recordCapturedPiece(byColor, pieceType) {
  if (byColor === 'white') capturedByWhite.push(pieceType);
  else capturedByBlack.push(pieceType);
  renderCapturedLists();
}

function renderCapturedLists() {
  capturedByWhiteEl.innerHTML = '';
  capturedByBlackEl.innerHTML = '';
  
  // Render captured by white (black pieces)
  for (let t of capturedByWhite) {
    const chip = document.createElement('div');
    chip.className = 'captured-piece';
    const img = document.createElement('img');
    img.src = getImageForPiece('black', t);
    img.alt = t;
    chip.appendChild(img);
    capturedByWhiteEl.appendChild(chip);
  }
  
  // Render captured by black (white pieces)
  for (let t of capturedByBlack) {
    const chip = document.createElement('div');
    chip.className = 'captured-piece';
    const img = document.createElement('img');
    img.src = getImageForPiece('white', t);
    img.alt = t;
    chip.appendChild(img);
    capturedByBlackEl.appendChild(chip);
  }
}

/* ---------- Move list functionality ---------- */
function updateMoveList() {
  moveList.innerHTML = '';
  moves.forEach((move, index) => {
    const moveItem = document.createElement('div');
    moveItem.className = 'move-list-item';
    if (index === moves.length - 1) {
      moveItem.classList.add('current');
    }
    
    const moveNumber = Math.floor(index / 2) + 1;
    const isWhiteMove = index % 2 === 0;
    const moveNotation = `${move.from}-${move.to}`;
    
    if (isWhiteMove) {
      moveItem.textContent = `${moveNumber}. ${moveNotation}`;
    } else {
      moveItem.textContent = `${moveNotation}`;
    }
    
    moveItem.addEventListener('click', () => {
      // Optional: Add functionality to navigate to specific move
      console.log(`Move ${index + 1}: ${moveNotation}`);
    });
    
    moveList.appendChild(moveItem);
  });
  
  // Scroll to bottom to show latest move
  moveList.scrollTop = moveList.scrollHeight;
}

/* ---------- Move generation functions ---------- */
function getPossibleMoves(startingSquareId, piece, boardSquaresArray) {
  const pieceColor = piece.pieceColor;
  const pieceType = piece.pieceType;
  let legalSquares = [];
  if (pieceType == "rook") {
    legalSquares = getRookMoves(startingSquareId, pieceColor, boardSquaresArray);
    return legalSquares;
  }
  if (pieceType == "bishop") {
    legalSquares = getBishopMoves(startingSquareId, pieceColor, boardSquaresArray);
    return legalSquares;
  }
  if (pieceType == "queen") {
    legalSquares = getQueenMoves(startingSquareId, pieceColor, boardSquaresArray);
    return legalSquares;
  }
  if (pieceType == "knight") {
    legalSquares = getKnightMoves(startingSquareId, pieceColor, boardSquaresArray);
    return legalSquares;
  }
  if (pieceType == "pawn") {
    legalSquares = getPawnMoves(startingSquareId, pieceColor, boardSquaresArray);
    return legalSquares;
  }
  if (pieceType == "king") {
    legalSquares = getKingMoves(startingSquareId, pieceColor, boardSquaresArray);
    return legalSquares;
  }
}

function getPawnMoves(startingSquareId, pieceColor, boardSquaresArray) {
  let diogonalSquares = checkPawnDiagonalCaptures(
    startingSquareId,
    pieceColor,
    boardSquaresArray
  );
  let forwardSquares = checkPawnForwardMoves(
    startingSquareId,
    pieceColor,
    boardSquaresArray
  );
  const file = startingSquareId.charAt(0);
  const rank = startingSquareId.charAt(1);
  const rankNumber = parseInt(rank);
  const direction = pieceColor == "white" ? 1 : -1;
  let enPassantSquares = [];
  if (enPassantTarget !== "blank") {
    const targetFile = enPassantTarget.charAt(0);
    const targetRank = parseInt(enPassantTarget.charAt(1));
    if (Math.abs(targetFile.charCodeAt(0) - file.charCodeAt(0)) === 1 && targetRank === rankNumber + direction) {
      enPassantSquares.push(enPassantTarget);
    }
  }
  let legalSquares = [...diogonalSquares, ...forwardSquares, ...enPassantSquares];
  return legalSquares;
}

function checkPawnDiagonalCaptures(
  startingSquareId,
  pieceColor,
  boardSquaresArray
) {
  const file = startingSquareId.charAt(0);
  const rank = startingSquareId.charAt(1);
  const rankNumber = parseInt(rank);
  let legalSquares = [];
  let currentFile = file;
  let currentRank = rankNumber;

  const direction = pieceColor == "white" ? 1 : -1;
  if (!(rank == 8 && direction == 1) && !(rank == 1 && direction == -1))
    currentRank += direction;
  for (let i = -1; i <= 1; i += 2) {
    currentFile = String.fromCharCode(file.charCodeAt(0) + i);
    if (currentFile >= "a" && currentFile <= "h" && currentRank <= 8 && currentRank >= 1) {
      currentSquareId = currentFile + currentRank;
      let currentSquare = boardSquaresArray.find(
        (element) => element.squareId === currentSquareId
      );
      let squareContent = currentSquare.pieceColor;
      if (squareContent != "blank" && squareContent != pieceColor)
        legalSquares.push(currentSquareId);
    }
  }
  return legalSquares;
}

function checkPawnForwardMoves(
  startingSquareId,
  pieceColor,
  boardSquaresArray
) {
  const file = startingSquareId.charAt(0);
  const rank = startingSquareId.charAt(1);
  const rankNumber = parseInt(rank);
  let legalSquares = [];

  let currentFile = file;
  let currentRank = rankNumber;

  const direction = pieceColor == "white" ? 1 : -1;
  currentRank += direction;
  currentSquareId = currentFile + currentRank;
  let currentSquare = boardSquaresArray.find(
    (element) => element.squareId === currentSquareId
  );
  let squareContent = currentSquare ? currentSquare.pieceColor : "blank";
  if (squareContent != "blank") return legalSquares;
  legalSquares.push(currentSquareId);
  if (!((rankNumber == 2 && pieceColor == "white") || (rankNumber == 7 && pieceColor == "black"))) return legalSquares;
  currentRank += direction;
  currentSquareId = currentFile + currentRank;
  currentSquare = boardSquaresArray.find(
    (element) => element.squareId === currentSquareId
  );
  squareContent = currentSquare ? currentSquare.pieceColor : "blank";
  if (squareContent != "blank") return legalSquares;
  legalSquares.push(currentSquareId);
  return legalSquares;
}

function getKnightMoves(startingSquareId, pieceColor, boardSquaresArray) {
  const file = startingSquareId.charCodeAt(0) - 97;
  const rank = startingSquareId.charAt(1);
  const rankNumber = parseInt(rank);
  let currentFile = file;
  let currentRank = rankNumber;
  let legalSquares = [];

  const moves = [
    [-2, 1],
    [-1, 2],
    [1, 2],
    [2, 1],
    [2, -1],
    [1, -2],
    [-1, -2],
    [-2, -1],
  ];
  moves.forEach((move) => {
    currentFile = file + move[0];
    currentRank = rankNumber + move[1];
    if (
      currentFile >= 0 &&
      currentFile <= 7 &&
      currentRank > 0 &&
      currentRank <= 8
    ) {
      let currentSquareId = String.fromCharCode(currentFile + 97) + currentRank;
      let currentSquare = boardSquaresArray.find(
        (element) => element.squareId === currentSquareId
      );
      let squareContent = currentSquare.pieceColor;
      if (squareContent != "blank" && squareContent == pieceColor)
        return;
      legalSquares.push(String.fromCharCode(currentFile + 97) + currentRank);
    }
  });
  return legalSquares;
}

function getRookMoves(startingSquareId, pieceColor, boardSquaresArray) {
  let moveToEighthRankSquares = moveToEighthRank(
    startingSquareId,
    pieceColor,
    boardSquaresArray
  );
  let moveToFirstRankSquares = moveToFirstRank(
    startingSquareId,
    pieceColor,
    boardSquaresArray
  );
  let moveToAFileSquares = moveToAFile(
    startingSquareId,
    pieceColor,
    boardSquaresArray
  );
  let moveToHFileSquares = moveToHFile(
    startingSquareId,
    pieceColor,
    boardSquaresArray
  );
  let legalSquares = [
    ...moveToEighthRankSquares,
    ...moveToFirstRankSquares,
    ...moveToAFileSquares,
    ...moveToHFileSquares,
  ];
  return legalSquares;
}

function getBishopMoves(startingSquareId, pieceColor, boardSquaresArray) {
  let moveToEighthRankHFileSquares = moveToEighthRankHFile(
    startingSquareId,
    pieceColor,
    boardSquaresArray
  );
  let moveToEighthRankAFileSquares = moveToEighthRankAFile(
    startingSquareId,
    pieceColor,
    boardSquaresArray
  );
  let moveToFirstRankHFileSquares = moveToFirstRankHFile(
    startingSquareId,
    pieceColor,
    boardSquaresArray
  );
  let moveToFirstRankAFileSquares = moveToFirstRankAFile(
    startingSquareId,
    pieceColor,
    boardSquaresArray
  );
  let legalSquares = [
    ...moveToEighthRankHFileSquares,
    ...moveToEighthRankAFileSquares,
    ...moveToFirstRankHFileSquares,
    ...moveToFirstRankAFileSquares,
  ];
  return legalSquares;
}

function getQueenMoves(startingSquareId, pieceColor, boardSquaresArray) {
  let bishopMoves = getBishopMoves(
    startingSquareId,
    pieceColor,
    boardSquaresArray
  );
  let rookMoves = getRookMoves(startingSquareId, pieceColor, boardSquaresArray);
  let legalSquares = [...bishopMoves, ...rookMoves];
  return legalSquares;
}

function getKingMoves(startingSquareId, pieceColor, boardSquaresArray) {
  const file = startingSquareId.charCodeAt(0) - 97;
  const rank = startingSquareId.charAt(1);
  const rankNumber = parseInt(rank);
  let currentFile = file;
  let currentRank = rankNumber;
  let legalSquares = [];
  const moves = [
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 0],
    [-1, 1],
    [-1, -1],
    [1, 0],
  ];

  moves.forEach((move) => {
    let currentFile = file + move[0];
    let currentRank = rankNumber + move[1];

    if (
      currentFile >= 0 &&
      currentFile <= 7 &&
      currentRank > 0 &&
      currentRank <= 8
    ) {
      let currentSquareId = String.fromCharCode(currentFile + 97) + currentRank;
      let currentSquare = boardSquaresArray.find((element) => element.squareId === currentSquareId);
      let squareContent = currentSquare.pieceColor;
      if (squareContent != "blank" && squareContent == pieceColor) {
        return;
      }
      legalSquares.push(String.fromCharCode(currentFile + 97) + currentRank);
    }
  });
  let shortCastleSquare = isShortCastlePossible(pieceColor, boardSquaresArray);
  let longCastleSquare = isLongCastlePossible(pieceColor, boardSquaresArray);
  if (shortCastleSquare != "blank") legalSquares.push(shortCastleSquare);
  if (longCastleSquare != "blank") legalSquares.push(longCastleSquare);

  return legalSquares;
}

function isShortCastlePossible(pieceColor, boardSquaresArray) {
  let rank = pieceColor === "white" ? "1" : "8";
  let fSquare = boardSquaresArray.find(element => element.squareId === `f${rank}`);
  let gSquare = boardSquaresArray.find(element => element.squareId === `g${rank}`);
  if (fSquare.pieceColor !== "blank" || gSquare.pieceColor !== "blank" || kingHasMoved(pieceColor) || rookHasMoved(pieceColor, `h${rank}`)) {
    return "blank";
  }
  return `g${rank}`;
}

function isLongCastlePossible(pieceColor, boardSquaresArray) {
  let rank = pieceColor === "white" ? "1" : "8";
  let dSquare = boardSquaresArray.find(element => element.squareId === `d${rank}`);
  let cSquare = boardSquaresArray.find(element => element.squareId === `c${rank}`);
  let bSquare = boardSquaresArray.find(element => element.squareId === `b${rank}`);

  if (dSquare.pieceColor !== "blank" || cSquare.pieceColor !== "blank" || bSquare.pieceColor !== "blank" || kingHasMoved(pieceColor) || rookHasMoved(pieceColor, `a${rank}`)) {
    return "blank";
  }
  return `c${rank}`;
}

function kingHasMoved(pieceColor) {
  let result = moves.find((element) => (element.pieceColor === pieceColor) && (element.pieceType === "king"));
  if (result != undefined) return true;
  return false;
}

function rookHasMoved(pieceColor, startingSquareId) {
  let result = moves.find((element) => (element.pieceColor === pieceColor) && (element.pieceType === "rook") && (element.from == startingSquareId));
  if (result != undefined) return true;
  return false;
}

function moveToEighthRank(startingSquareId, pieceColor, boardSquaresArray) {
  const file = startingSquareId.charAt(0);
  const rank = startingSquareId.charAt(1);
  const rankNumber = parseInt(rank);
  let currentRank = rankNumber;
  let legalSquares = [];
  while (currentRank != 8) {
    currentRank++;
    let currentSquareId = file + currentRank;
    let currentSquare = boardSquaresArray.find(
      (element) => element.squareId === currentSquareId
    );
    let squareContent = currentSquare.pieceColor;
    if (squareContent != "blank" && squareContent == pieceColor)
      return legalSquares;
    legalSquares.push(currentSquareId);
    if (squareContent != "blank" && squareContent != pieceColor)
      return legalSquares;
  }
  return legalSquares;
}

function moveToFirstRank(startingSquareId, pieceColor, boardSquaresArray) {
  const file = startingSquareId.charAt(0);
  const rank = startingSquareId.charAt(1);
  const rankNumber = parseInt(rank);
  let currentRank = rankNumber;
  let legalSquares = [];
  while (currentRank != 1) {
    currentRank--;
    let currentSquareId = file + currentRank;
    let currentSquare = boardSquaresArray.find(
      (element) => element.squareId === currentSquareId
    );
    let squareContent = currentSquare.pieceColor;
    if (squareContent != "blank" && squareContent == pieceColor)
      return legalSquares;
    legalSquares.push(currentSquareId);
    if (squareContent != "blank" && squareContent != pieceColor)
      return legalSquares;
  }
  return legalSquares;
}

function moveToAFile(startingSquareId, pieceColor, boardSquaresArray) {
  const file = startingSquareId.charAt(0);
  const rank = startingSquareId.charAt(1);
  let currentFile = file;
  let legalSquares = [];

  while (currentFile != "a") {
    currentFile = String.fromCharCode(
      currentFile.charCodeAt(currentFile.length - 1) - 1
    );
    let currentSquareId = currentFile + rank;
    let currentSquare = boardSquaresArray.find(
      (element) => element.squareId === currentSquareId
    );
    let squareContent = currentSquare.pieceColor;
    if (squareContent != "blank" && squareContent == pieceColor)
      return legalSquares;
    legalSquares.push(currentSquareId);
    if (squareContent != "blank" && squareContent != pieceColor)
      return legalSquares;
  }
  return legalSquares;
}

function moveToHFile(startingSquareId, pieceColor, boardSquaresArray) {
  const file = startingSquareId.charAt(0);
  const rank = startingSquareId.charAt(1);
  let currentFile = file;
  let legalSquares = [];
  while (currentFile != "h") {
    currentFile = String.fromCharCode(
      currentFile.charCodeAt(currentFile.length - 1) + 1
    );
    let currentSquareId = currentFile + rank;
    let currentSquare = boardSquaresArray.find(
      (element) => element.squareId === currentSquareId
    );
    let squareContent = currentSquare.pieceColor;
    if (squareContent != "blank" && squareContent == pieceColor)
      return legalSquares;
    legalSquares.push(currentSquareId);
    if (squareContent != "blank" && squareContent != pieceColor)
      return legalSquares;
  }
  return legalSquares;
}

function moveToEighthRankAFile(startingSquareId, pieceColor, boardSquaresArray) {
  const file = startingSquareId.charAt(0);
  const rank = startingSquareId.charAt(1);
  const rankNumber = parseInt(rank);
  let currentFile = file;
  let currentRank = rankNumber;
  let legalSquares = [];
  while (!(currentFile == "a" || currentRank == 8)) {
    currentFile = String.fromCharCode(
      currentFile.charCodeAt(currentFile.length - 1) - 1
    );
    currentRank++;
    let currentSquareId = currentFile + currentRank;
    let currentSquare = boardSquaresArray.find(
      (element) => element.squareId === currentSquareId
    );
    let squareContent = currentSquare.pieceColor;
    if (squareContent != "blank" && squareContent == pieceColor)
      return legalSquares;
    legalSquares.push(currentSquareId);
    if (squareContent != "blank" && squareContent != pieceColor)
      return legalSquares;
  }
  return legalSquares;
}

function moveToEighthRankHFile(startingSquareId, pieceColor, boardSquaresArray) {
  const file = startingSquareId.charAt(0);
  const rank = startingSquareId.charAt(1);
  const rankNumber = parseInt(rank);
  let currentFile = file;
  let currentRank = rankNumber;
  let legalSquares = [];
  while (!(currentFile == "h" || currentRank == 8)) {
    currentFile = String.fromCharCode(
      currentFile.charCodeAt(currentFile.length - 1) + 1
    );
    currentRank++;
    let currentSquareId = currentFile + currentRank;
    let currentSquare = boardSquaresArray.find(
      (element) => element.squareId === currentSquareId
    );
    let squareContent = currentSquare.pieceColor;
    if (squareContent != "blank" && squareContent == pieceColor)
      return legalSquares;
    legalSquares.push(currentSquareId);
    if (squareContent != "blank" && squareContent != pieceColor)
      return legalSquares;
  }
  return legalSquares;
}

function moveToFirstRankAFile(startingSquareId, pieceColor, boardSquaresArray) {
  const file = startingSquareId.charAt(0);
  const rank = startingSquareId.charAt(1);
  const rankNumber = parseInt(rank);
  let currentFile = file;
  let currentRank = rankNumber;
  let legalSquares = [];
  while (!(currentFile == "a" || currentRank == 1)) {
    currentFile = String.fromCharCode(
      currentFile.charCodeAt(currentFile.length - 1) - 1
    );
    currentRank--;
    let currentSquareId = currentFile + currentRank;
    let currentSquare = boardSquaresArray.find(
      (element) => element.squareId === currentSquareId
    );
    let squareContent = currentSquare.pieceColor;
    if (squareContent != "blank" && squareContent == pieceColor)
      return legalSquares;
    legalSquares.push(currentSquareId);
    if (squareContent != "blank" && squareContent != pieceColor)
      return legalSquares;
  }
  return legalSquares;
}

function moveToFirstRankHFile(startingSquareId, pieceColor, boardSquaresArray) {
  const file = startingSquareId.charAt(0);
  const rank = startingSquareId.charAt(1);
  const rankNumber = parseInt(rank);
  let currentFile = file;
  let currentRank = rankNumber;
  let legalSquares = [];
  while (!(currentFile == "h" || currentRank == 1)) {
    currentFile = String.fromCharCode(
      currentFile.charCodeAt(currentFile.length - 1) + 1
    );
    currentRank--;
    let currentSquareId = currentFile + currentRank;
    let currentSquare = boardSquaresArray.find(
      (element) => element.squareId === currentSquareId
    );
    let squareContent = currentSquare.pieceColor;
    if (squareContent != "blank" && squareContent == pieceColor)
      return legalSquares;
    legalSquares.push(currentSquareId);
    if (squareContent != "blank" && squareContent != pieceColor)
      return legalSquares;
  }
  return legalSquares;
}

function getPieceAtSquare(squareId, boardArr) {
  let currentSquare = boardArr.find(element => element.squareId === squareId);
  return { pieceColor: currentSquare ? currentSquare.pieceColor : "blank", pieceType: currentSquare ? currentSquare.pieceType : "blank", pieceId: currentSquare ? currentSquare.pieceId : "blank" };
}

function isKingInCheck(squareId, pieceColor, boardSquaresArray) {
  let legalSquares = getRookMoves(squareId, pieceColor, boardSquaresArray);
  for (let squareId of legalSquares) {
    let pieceProperties = getPieceAtSquare(squareId, boardSquaresArray);
    if (
      (pieceProperties.pieceType == "rook" || pieceProperties.pieceType == "queen") && pieceColor != pieceProperties.pieceColor
    )
      return true;
  }
  legalSquares = getBishopMoves(squareId, pieceColor, boardSquaresArray);
  for (let squareId of legalSquares) {
    let pieceProperties = getPieceAtSquare(squareId, boardSquaresArray);
    if (
      (pieceProperties.pieceType == "bishop" || pieceProperties.pieceType == "queen") && pieceColor != pieceProperties.pieceColor
    )
      return true;
  }
  legalSquares = getKnightMoves(squareId, pieceColor, boardSquaresArray);
  for (let squareId of legalSquares) {
    let pieceProperties = getPieceAtSquare(squareId, boardSquaresArray);
    if (
      (pieceProperties.pieceType == "knight") && pieceColor != pieceProperties.pieceColor
    )
      return true;
  }
  legalSquares = checkPawnDiagonalCaptures(squareId, pieceColor, boardSquaresArray);
  for (let squareId of legalSquares) {
    let pieceProperties = getPieceAtSquare(squareId, boardSquaresArray);
    if (
      (pieceProperties.pieceType == "pawn") && pieceColor != pieceProperties.pieceColor
    )
      return true;
  }
  legalSquares = getKingMoves(squareId, pieceColor, boardSquaresArray);
  for (let squareId of legalSquares) {
    let pieceProperties = getPieceAtSquare(squareId, boardSquaresArray);
    if (
      (pieceProperties.pieceType == "king") && pieceColor != pieceProperties.pieceColor
    )
      return true;
  }
  return false;
}

function getkingLastMove(color) {
  let kingLastMove = moves.findLast(element => element.pieceType === "king" && element.pieceColor === color);
  if (kingLastMove == undefined)
    return color === "white" ? "e1" : "e8";
  return kingLastMove.to;
}

function isMoveValidAgainstCheck(legalSquares, startingSquareId, pieceColor, pieceType) {
  let kingSquare = isWhiteTurn ? getkingLastMove("white") : getkingLastMove("black");
  let boardSquaresArrayCopy = deepCopyArray(boardSquaresArray);
  let legalSquaresCopy = legalSquares.slice();
  legalSquaresCopy.forEach((element) => {
    let destinationId = element;
    boardSquaresArrayCopy = deepCopyArray(boardSquaresArray);
    updateBoardSquaresArray(startingSquareId, destinationId, boardSquaresArrayCopy);
    if (pieceType != "king" && isKingInCheck(kingSquare, pieceColor, boardSquaresArrayCopy)) {
      legalSquares = legalSquares.filter((item) => item != destinationId);
    }
    if (pieceType == "king" && isKingInCheck(destinationId, pieceColor, boardSquaresArrayCopy)) {
      legalSquares = legalSquares.filter((item) => item != destinationId);
    }
  });
  return legalSquares;
}

function checkForCheckMate() {
  let kingSquare = isWhiteTurn ? getkingLastMove("white") : getkingLastMove("black");
  let kingColor = isWhiteTurn ? "white" : "black";
  
  // Check if king is in check
  const inCheck = isKingInCheck(kingSquare, kingColor, boardSquaresArray);
  if (inCheck) {
    console.log("CHECK! " + kingColor + " king is in check");
  }
  
  let kingPiece = { pieceColor: kingColor, pieceType: "king" };
  let kingMoves = getPossibleMoves(kingSquare, kingPiece, boardSquaresArray);
  kingMoves = isMoveValidAgainstCheck(kingMoves, kingSquare, kingColor, "king");
  
  if (kingMoves.length == 0) {
    let pieces = boardSquaresArray.filter(element => element.pieceColor == kingColor && element.pieceType != "king");
    let hasMoves = false;
    pieces.forEach(element => {
      let piece = { pieceColor: element.pieceColor, pieceType: element.pieceType };
      let pieceMoves = getPossibleMoves(element.squareId, piece, boardSquaresArray);
      pieceMoves = isMoveValidAgainstCheck(pieceMoves, element.squareId, kingColor, element.pieceType);
      if (pieceMoves.length > 0) hasMoves = true;
    });
    
    if (!hasMoves) {
      if (inCheck) {
        console.log("CHECKMATE! " + (kingColor === "white" ? "Black" : "White") + " wins!");
        endGame(`Checkmate! ${kingColor === "white" ? "Black" : "White"} wins!`);
      } else {
        console.log("STALEMATE! It's a draw!");
        endGame("Stalemate! It's a draw!");
      }
    }
  }
}

function performCastling(piece, pieceColor, startingSquareId, destinationSquareId, boardSquaresArray) {
  let rank = pieceColor === "white" ? "1" : "8";
  if (destinationSquareId === `g${rank}`) {
    let rookSquareId = `h${rank}`;
    let rookNewSquareId = `f${rank}`;
    let rook = document.getElementById(`rook${rookSquareId}`);
    document.getElementById(rookNewSquareId).appendChild(rook);
    updateBoardSquaresArray(rookSquareId, rookNewSquareId, boardSquaresArray);
  } else if (destinationSquareId === `c${rank}`) {
    let rookSquareId = `a${rank}`;
    let rookNewSquareId = `d${rank}`;
    let rook = document.getElementById(`rook${rookSquareId}`);
    document.getElementById(rookNewSquareId).appendChild(rook);
    updateBoardSquaresArray(rookSquareId, rookNewSquareId, boardSquaresArray);
  }
  document.getElementById(destinationSquareId).appendChild(piece);
  updateBoardSquaresArray(startingSquareId, destinationSquareId, boardSquaresArray);
  isWhiteTurn = !isWhiteTurn;
  setActiveColorFromTurn();
  makeMove(startingSquareId, destinationSquareId, "king", pieceColor, false, { castling: true });
  pushPositionAndCheckDraws();
  checkForCheckMate();
}

function maybePromotePawn(destinationSquareId, pieceColor, piece) {
  const rank = destinationSquareId.charAt(1);
  if ((pieceColor === "white" && rank === "8") || (pieceColor === "black" && rank === "1")) {
    showPromotionOptions(destinationSquareId, pieceColor, piece);
  }
}

function showPromotionOptions(squareId, pieceColor, piece) {
  promotionBox.style.display = "block";
  promotionOptions.innerHTML = "";
  const promotionPieces = ["queen", "rook", "bishop", "knight"];
  promotionPieces.forEach(pieceType => {
    const option = document.createElement("div");
    option.className = "promotion-option";
    const img = document.createElement("img");
    img.src = getImageForPiece(pieceColor, pieceType);
    img.alt = pieceType;
    option.appendChild(img);
    option.addEventListener("click", () => promotePawn(squareId, pieceColor, pieceType, piece));
    promotionOptions.appendChild(option);
  });
}

function promotePawn(squareId, pieceColor, pieceType, piece) {
  const square = document.getElementById(squareId);
  square.removeChild(piece);
  const newPiece = document.createElement("div");
  newPiece.className = `piece ${pieceType}`;
  newPiece.setAttribute("color", pieceColor);
  newPiece.id = pieceType + squareId;
  newPiece.setAttribute("draggable", true);
  newPiece.addEventListener("dragstart", drag);
  newPiece.addEventListener("dragend", function(ev) {
    clearMoveDots();
    ev.target.closest('.piece')?.classList.remove('moving');
  });
  newPiece.addEventListener("click", handlePieceClick);
  newPiece.addEventListener("touchstart", handlePieceTouch, { passive: false });
  const img = document.createElement("img");
  img.src = getImageForPiece(pieceColor, pieceType);
  img.alt = pieceType;
  img.setAttribute("draggable", false);
  newPiece.appendChild(img);
  square.appendChild(newPiece);
  promotionBox.style.display = "none";
  let boardArrIndex = boardSquaresArray.findIndex(el => el.squareId === squareId);
  if (boardArrIndex !== -1) {
    boardSquaresArray[boardArrIndex].pieceType = pieceType;
    boardSquaresArray[boardArrIndex].pieceId = newPiece.id;
  }
  saveGameState();
}

/* ---------- Previous-move UI helpers ---------- */
function updatePreviousMoveUI(moveObj) {
  if (!moveObj) {
    prevMoveText.textContent = "No moves yet";
    clearLastMoveHighlight();
    return;
  }
  const notation = `${moveObj.from}-${moveObj.to}`;
  prevMoveText.textContent = notation;
  highlightLastMove(moveObj.from, moveObj.to);
}

function highlightLastMove(from, to) {
  clearLastMoveHighlight();
  const fromSq = document.getElementById(from);
  const toSq = document.getElementById(to);
  if (fromSq) fromSq.classList.add('last-move');
  if (toSq) toSq.classList.add('last-move');
}

function clearLastMoveHighlight() {
  const last = document.querySelectorAll('.square.last-move');
  last.forEach(s => s.classList.remove('last-move'));
}

/* ---------- Draw rules helpers ---------- */
function getPositionSignature(squaresArray) {
  return squaresArray.map(s => {
    if (s.pieceColor === "blank") return "1";
    return s.pieceColor.charAt(0) + s.pieceType.charAt(0);
  }).join("") + "|" + (isWhiteTurn ? "w" : "b") + "|" + enPassantTarget;
}

function pushPositionAndCheckDraws() {
  const sig = getPositionSignature(boardSquaresArray);
  positionHistory.push(sig);
  let occurrences = positionHistory.filter(p => p === sig).length;
  if (occurrences >= 3) { showAlert("Draw by threefold repetition"); return; }
  if (halfmoveClock >= 100) { showAlert("Draw by 50-move rule"); return; }
  if (isInsufficientMaterial()) { showAlert("Draw by insufficient material"); return; }
}

function isInsufficientMaterial() {
  const piecesLeft = boardSquaresArray.filter(s => s.pieceType !== "blank" && s.pieceType !== "king");
  if (piecesLeft.length === 0) return true;
  if (piecesLeft.length === 1) {
    const p = piecesLeft[0];
    if (p.pieceType === "bishop" || p.pieceType === "knight") return true;
  }
  return false;
}

/* ---------- Timer formatting / updates ---------- */
function formatTime(seconds) {
  if (seconds === 0 || seconds < 0) {
    return "∞";
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function updateTimers() {
  const whiteTimeStr = formatTime(whiteTime);
  const blackTimeStr = formatTime(blackTime);
  
  if (whiteTimerEl) whiteTimerEl.textContent = whiteTimeStr;
  if (blackTimerEl) blackTimerEl.textContent = blackTimeStr;
  
  // Update mobile side timers
  const whiteTimerMobile = document.getElementById('white-timer-mobile');
  const blackTimerMobile = document.getElementById('black-timer-mobile');
  if (whiteTimerMobile) whiteTimerMobile.textContent = whiteTimeStr;
  if (blackTimerMobile) blackTimerMobile.textContent = blackTimeStr;
  
  // Update mobile timer card
  const whiteTimerCard = document.getElementById('white-timer-card');
  const blackTimerCard = document.getElementById('black-timer-card');
  if (whiteTimerCard) whiteTimerCard.textContent = whiteTimeStr;
  if (blackTimerCard) blackTimerCard.textContent = blackTimeStr;
  
  // Update timer colors based on active player
  if (activeColor === "white") {
    if (whiteTimerEl) whiteTimerEl.classList.add('active');
    if (blackTimerEl) blackTimerEl.classList.remove('active');
    if (whiteTimerMobile) whiteTimerMobile.classList.add('active');
    if (blackTimerMobile) blackTimerMobile.classList.remove('active');
    if (whiteTimerCard) whiteTimerCard.classList.add('active');
    if (blackTimerCard) blackTimerCard.classList.remove('active');
  } else {
    if (blackTimerEl) blackTimerEl.classList.add('active');
    if (whiteTimerEl) whiteTimerEl.classList.remove('active');
    if (blackTimerMobile) blackTimerMobile.classList.add('active');
    if (whiteTimerMobile) whiteTimerMobile.classList.remove('active');
    if (blackTimerCard) blackTimerCard.classList.add('active');
    if (whiteTimerCard) whiteTimerCard.classList.remove('active');
  }
}

/* ---------- Timer starts immediately for new game ---------- */
function startGameTimer() {
  if (isRunning && timerInterval) return; // Already running
  
  // Don't start timer if time is 0 (no time mode)
  if (whiteTime === 0 && blackTime === 0) {
    isRunning = false;
    return;
  }
  
  isRunning = true;
  clearInterval(timerInterval);
  setTimerVisualActive();

  console.log("Game timer started. Active color:", activeColor);
  
  timerInterval = setInterval(() => {
    // Don't count down if in no time mode
    if (whiteTime === 0 && blackTime === 0) {
      clearInterval(timerInterval);
      isRunning = false;
      return;
    }
    
    if (activeColor === "white") {
      if (whiteTime > 0) {
        whiteTime--;
        if (whiteTime <= 0) {
          endGame("Black wins on time!");
          return;
        }
      }
    } else {
      if (blackTime > 0) {
        blackTime--;
        if (blackTime <= 0) {
          endGame("White wins on time!");
          return;
        }
      }
    }
    updateTimers();
    saveGameState();
  }, 1000);
}

function stopGameTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  whiteTimerEl.classList.remove('active');
  blackTimerEl.classList.remove('active');
}

function setTimerVisualActive() {
  if (activeColor === "white") {
    whiteTimerEl.classList.add('active');
    blackTimerEl.classList.remove('active');
  } else {
    blackTimerEl.classList.add('active');
    whiteTimerEl.classList.remove('active');
  }
}

function setActiveColorFromTurn() {
  activeColor = isWhiteTurn ? "white" : "black";
  setTimerVisualActive();
}

/* ---------- Resign button handler ---------- */
const resignBtn = document.getElementById("resignBtn");
const drawBtn = document.getElementById("drawBtn");

resignBtn.addEventListener('click', () => {
  if (!confirm("Are you sure you want to resign?")) return;
  
  const resigningColor = isWhiteTurn ? "White" : "Black";
  const winner = isWhiteTurn ? "Black" : "White";
  endGame(`${resigningColor} resigns! ${winner} wins!`);
  resetBoardPosition();
});

drawBtn.addEventListener('click', () => {
  const currentPlayer = isWhiteTurn ? "white" : "black";
  
  // If no draw offer exists, create one
  if (drawOfferFrom === null) {
    drawOfferFrom = currentPlayer;
    drawAcceptedBy = null;
    drawBtn.textContent = "Cancel Draw Offer";
    drawBtn.classList.add('draw-offered');
    showAlert(`${currentPlayer === "white" ? "White" : "Black"} offers a draw. Waiting for opponent...`);
    
    // Update mobile button
    const drawBtnMobile = document.getElementById('drawBtnMobile');
    if (drawBtnMobile) {
      drawBtnMobile.classList.add('draw-offered');
    }
    
    // Hide mobile confirmation if it was showing
    const mobileDrawConfirm = document.getElementById('mobileDrawConfirm');
    if (mobileDrawConfirm) {
      mobileDrawConfirm.classList.remove('show');
    }
  } 
  // If current player already offered, cancel it
  else if (drawOfferFrom === currentPlayer) {
    drawOfferFrom = null;
    drawAcceptedBy = null;
    drawBtn.textContent = "Offer Draw";
    drawBtn.classList.remove('draw-offered');
    showAlert("Draw offer cancelled.");
    
    // Update mobile button
    const drawBtnMobile = document.getElementById('drawBtnMobile');
    if (drawBtnMobile) {
      drawBtnMobile.classList.remove('draw-offered');
    }
    
    // Hide mobile confirmation
    const mobileDrawConfirm = document.getElementById('mobileDrawConfirm');
    if (mobileDrawConfirm) {
      mobileDrawConfirm.classList.remove('show');
    }
  }
  // If opponent offered, accept it (desktop uses confirm, mobile uses custom UI)
  else if (drawOfferFrom !== currentPlayer) {
    // Check if we're on mobile (screen width < 768px)
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      // Show mobile confirmation UI
      const mobileDrawConfirm = document.getElementById('mobileDrawConfirm');
      const mobileDrawMessage = document.getElementById('mobileDrawMessage');
      if (mobileDrawConfirm && mobileDrawMessage) {
        const opponentColor = drawOfferFrom === "white" ? "White" : "Black";
        mobileDrawMessage.textContent = `${opponentColor} offers a draw`;
        mobileDrawConfirm.classList.add('show');
      }
    } else {
      // Desktop: use browser confirm
      if (confirm("Accept the draw offer?")) {
        endGame("Game drawn by agreement!");
        resetBoardPosition();
      }
    }
  }
});

/* ---------- Time control selector handler ---------- */
timeSelect.addEventListener('change', function() {
  const selectedTime = parseInt(this.value, 10);
  whiteTime = selectedTime;
  blackTime = selectedTime;
  
  // Stop timer if switching to no time mode
  if (selectedTime === 0) {
    clearInterval(timerInterval);
    isRunning = false;
    whiteTimerEl.classList.remove('active');
    blackTimerEl.classList.remove('active');
  }
  
  updateTimers();
  saveGameState();
});

/* ---------- New game button ---------- */
newGameBtn.addEventListener('click', () => {
  if (!confirm("Start a new game? This will clear the current game state.")) return;
  
  resetBoardPosition();
  const selected = parseInt(timeSelect.value, 10);
  whiteTime = selected;
  blackTime = selected;
  
  // Stop timer if no time mode
  if (selected === 0) {
    clearInterval(timerInterval);
    isRunning = false;
    whiteTimerEl.classList.remove('active');
    blackTimerEl.classList.remove('active');
  }
  
  updateTimers();
  
  moves = [];
  positionHistory = [];
  capturedByWhite = [];
  capturedByBlack = [];
  renderCapturedLists();
  updatePreviousMoveUI(null);
  updateMoveList();
  isWhiteTurn = true;
  enPassantTarget = "blank";
  halfmoveClock = 0;
  
  // Start the timer immediately for white
  isRunning = true;
  activeColor = "white";
  startGameTimer();
  
  saveGameState();
  resignBtn.textContent = 'Resign';
  
  // Reset draw offer
  drawOfferFrom = null;
  drawAcceptedBy = null;
  if (drawBtn) {
    drawBtn.textContent = "Offer Draw";
    drawBtn.classList.remove('draw-offered');
  }
  const drawBtnMobile = document.getElementById('drawBtnMobile');
  if (drawBtnMobile) {
    drawBtnMobile.classList.remove('draw-offered');
  }
  // Hide mobile draw confirmation
  const mobileDrawConfirm = document.getElementById('mobileDrawConfirm');
  if (mobileDrawConfirm) {
    mobileDrawConfirm.classList.remove('show');
  }
});

/* ---------- End game handler ---------- */
function endGame(message) {
  stopGameTimer();
  showAlert(message);
  //startBtn.textContent = 'Start';
  isRunning = false;
  saveGameState();
}

/* ---------- Alert & flash helpers ---------- */
function showAlert(message) {
  console.log("ALERT:", message);
  const alert = document.getElementById("alert");
  if (alert) {
    alert.innerHTML = message;
    alert.style.display = "block";
    setTimeout(() => { alert.style.display = "none"; }, 3500);
  }
}

function flashRed(squareId) {
  const square = document.getElementById(squareId);
  if (!square) return;
  square.style.transition = "background-color 0.3s";
  const original = square.style.backgroundColor;
  square.style.backgroundColor = "red";
  setTimeout(() => { square.style.backgroundColor = original; }, 500);
}

/* ---------- Persistence: save/load game state ---------- */
const STORAGE_KEY = "my_chess_game_state_v1";

function saveGameState() {
  fillBoardSquaresArray();
  const payload = {
    board: boardSquaresArray,
    moves,
    isWhiteTurn,
    whiteTime,
    blackTime,
    enPassantTarget,
    halfmoveClock,
    positionHistory,
    capturedByWhite,
    capturedByBlack,
    isRunning,
    activeColor
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Could not save game state:", e);
  }
}

function loadGameState() {
  const txt = localStorage.getItem(STORAGE_KEY);
  if (!txt) return false;
  try {
    const p = JSON.parse(txt);
    whiteTime = p.whiteTime ?? whiteTime;
    blackTime = p.blackTime ?? blackTime;
    isWhiteTurn = p.isWhiteTurn ?? true;
    enPassantTarget = p.enPassantTarget ?? "blank";
    halfmoveClock = p.halfmoveClock ?? 0;
    positionHistory = p.positionHistory ?? [];
    moves = p.moves ?? [];
    capturedByWhite = p.capturedByWhite ?? [];
    capturedByBlack = p.capturedByBlack ?? [];
    isRunning = p.isRunning ?? false;
    activeColor = p.activeColor ?? "white";
    
    if (p.board && Array.isArray(p.board)) {
      applyBoardArrayToDOM(p.board);
      fillBoardSquaresArray();
    }
    updatePreviousMoveUI(moves.length ? moves[moves.length - 1] : null);
    renderCapturedLists();
    updateMoveList();
    updateTimers();
    
    if (p.isRunning) {
      isRunning = true;
      startGameTimer();
      //startBtn.textContent = 'Pause';
    }
    return true;
  } catch (e) {
    console.warn("Failed to load saved state:", e);
    return false;
  }
}

function applyBoardArrayToDOM(savedBoard) {
  for (let entry of savedBoard) {
    const squareEl = document.getElementById(entry.squareId);
    if (!squareEl) continue;
    removePieceFromSquare(squareEl);
    if (entry.pieceColor && entry.pieceColor !== "blank") {
      const pieceEl = document.createElement('div');
      pieceEl.className = `piece ${entry.pieceType}`;
      pieceEl.setAttribute('color', entry.pieceColor);
      pieceEl.id = entry.pieceId && entry.pieceId !== "blank" ? entry.pieceId : (entry.pieceType + entry.squareId);
      const img = document.createElement('img');
      img.className = 'pieceImage';
      img.src = getImageForPiece(entry.pieceColor, entry.pieceType);
      img.alt = `${entry.pieceType}_${entry.pieceColor}`;
      img.setAttribute('draggable', 'false');
      pieceEl.appendChild(img);
      squareEl.appendChild(pieceEl);
    }
  }
  setupPieces();
}

/* ---------- Reset board to initial position ---------- */
function resetBoardPosition() {
  // Clear the board
  for (let i = 0; i < boardSquares.length; i++) {
    removePieceFromSquare(boardSquares[i]);
  }
  
  // Reset to initial position (same as HTML setup)
  const initialPosition = [
    // Black pieces (8th rank)
    { id: 'a8', piece: 'rook', color: 'black' },
    { id: 'b8', piece: 'knight', color: 'black' },
    { id: 'c8', piece: 'bishop', color: 'black' },
    { id: 'd8', piece: 'queen', color: 'black' },
    { id: 'e8', piece: 'king', color: 'black' },
    { id: 'f8', piece: 'bishop', color: 'black' },
    { id: 'g8', piece: 'knight', color: 'black' },
    { id: 'h8', piece: 'rook', color: 'black' },
    
    // Black pawns (7th rank)
    { id: 'a7', piece: 'pawn', color: 'black' },
    { id: 'b7', piece: 'pawn', color: 'black' },
    { id: 'c7', piece: 'pawn', color: 'black' },
    { id: 'd7', piece: 'pawn', color: 'black' },
    { id: 'e7', piece: 'pawn', color: 'black' },
    { id: 'f7', piece: 'pawn', color: 'black' },
    { id: 'g7', piece: 'pawn', color: 'black' },
    { id: 'h7', piece: 'pawn', color: 'black' },
    
    // White pawns (2nd rank)
    { id: 'a2', piece: 'pawn', color: 'white' },
    { id: 'b2', piece: 'pawn', color: 'white' },
    { id: 'c2', piece: 'pawn', color: 'white' },
    { id: 'd2', piece: 'pawn', color: 'white' },
    { id: 'e2', piece: 'pawn', color: 'white' },
    { id: 'f2', piece: 'pawn', color: 'white' },
    { id: 'g2', piece: 'pawn', color: 'white' },
    { id: 'h2', piece: 'pawn', color: 'white' },
    
    // White pieces (1st rank)
    { id: 'a1', piece: 'rook', color: 'white' },
    { id: 'b1', piece: 'knight', color: 'white' },
    { id: 'c1', piece: 'bishop', color: 'white' },
    { id: 'd1', piece: 'queen', color: 'white' },
    { id: 'e1', piece: 'king', color: 'white' },
    { id: 'f1', piece: 'bishop', color: 'white' },
    { id: 'g1', piece: 'knight', color: 'white' },
    { id: 'h1', piece: 'rook', color: 'white' }
  ];

  // Place pieces on board
  initialPosition.forEach(pos => {
    const square = document.getElementById(pos.id);
    if (square) {
      const piece = document.createElement("div");
      piece.className = `piece ${pos.piece}`;
      piece.setAttribute("color", pos.color);
      piece.id = pos.piece + pos.id;
      piece.setAttribute("draggable", true);
      
      const img = document.createElement("img");
      img.src = getImageForPiece(pos.color, pos.piece);
      img.alt = `${pos.color} ${pos.piece}`;
      img.setAttribute("draggable", false);
      piece.appendChild(img);
      
      square.appendChild(piece);
    }
  });

  // Re-setup pieces
  setupPieces();
  fillBoardSquaresArray();
}

/* ---------- Initialize on DOMContentLoaded ---------- */
document.addEventListener("DOMContentLoaded", () => {
  setupBoardSquares();
  setupPieces();
  fillBoardSquaresArray();
  renderCapturedLists();
  updateTimers();
  updatePreviousMoveUI(null);
  updateMoveList();

  const restored = loadGameState();
  if (!restored) {
    const selected = parseInt(timeSelect.value, 10);
    whiteTime = selected;
    blackTime = selected;
    updateTimers();
  }

  console.log("Chess board initialized successfully!");

  // Mobile menu setup
  setupMobileMenu();
});

/* ---------- MOBILE MENU SETUP ---------- */
function setupMobileMenu() {
  // Sync mobile buttons with desktop buttons
  const resignBtnMobile = document.getElementById('resignBtnMobile');
  const newGameBtnMobile = document.getElementById('newGameBtnMobile');
  const timeControlBtnMobile = document.getElementById('timeControlBtnMobile');
  const resignBtn = document.getElementById('resignBtn');
  const newGameBtn = document.getElementById('newGameBtn');
  const timeSelect = document.getElementById('timeSelect');
  const timeSelectMobile = document.getElementById('timeSelectMobile');
  const mobileTimeModal = document.getElementById('mobileTimeModal');
  const mobileTimeClose = document.querySelector('.mobile-time-close');

  if (resignBtnMobile && resignBtn) {
    resignBtnMobile.addEventListener('click', () => resignBtn.click());
    resignBtnMobile.classList.add('danger');
  }

  const drawBtnMobile = document.getElementById('drawBtnMobile');
  const drawBtn = document.getElementById('drawBtn');
  const mobileDrawConfirm = document.getElementById('mobileDrawConfirm');
  const mobileDrawAccept = document.getElementById('mobileDrawAccept');
  const mobileDrawDecline = document.getElementById('mobileDrawDecline');
  const mobileDrawMessage = document.getElementById('mobileDrawMessage');
  
  if (drawBtnMobile && drawBtn) {
    drawBtnMobile.addEventListener('click', () => {
      const currentPlayer = isWhiteTurn ? "white" : "black";
      
      // If no draw offer exists, create one
      if (drawOfferFrom === null) {
        drawOfferFrom = currentPlayer;
        drawAcceptedBy = null;
        drawBtn.textContent = "Cancel Draw Offer";
        drawBtn.classList.add('draw-offered');
        showAlert(`${currentPlayer === "white" ? "White" : "Black"} offers a draw. Waiting for opponent...`);
        
        // Update mobile button
        drawBtnMobile.classList.add('draw-offered');
      } 
      // If current player already offered, cancel it
      else if (drawOfferFrom === currentPlayer) {
        drawOfferFrom = null;
        drawAcceptedBy = null;
        drawBtn.textContent = "Offer Draw";
        drawBtn.classList.remove('draw-offered');
        showAlert("Draw offer cancelled.");
        
        // Update mobile button and hide confirmation
        drawBtnMobile.classList.remove('draw-offered');
        if (mobileDrawConfirm) {
          mobileDrawConfirm.classList.remove('show');
        }
      }
      // If opponent offered, show mobile confirmation UI
      else if (drawOfferFrom !== currentPlayer) {
        // Show mobile confirmation UI instead of browser confirm
        if (mobileDrawConfirm && mobileDrawMessage) {
          const opponentColor = drawOfferFrom === "white" ? "White" : "Black";
          mobileDrawMessage.textContent = `${opponentColor} offers a draw`;
          mobileDrawConfirm.classList.add('show');
        }
      }
    });
  }
  
  // Handle draw acceptance
  if (mobileDrawAccept) {
    mobileDrawAccept.addEventListener('click', () => {
      if (drawOfferFrom && drawOfferFrom !== (isWhiteTurn ? "white" : "black")) {
        endGame("Game drawn by agreement!");
        resetBoardPosition();
        if (mobileDrawConfirm) {
          mobileDrawConfirm.classList.remove('show');
        }
      }
    });
  }
  
  // Handle draw decline
  if (mobileDrawDecline) {
    mobileDrawDecline.addEventListener('click', () => {
      if (drawOfferFrom && drawOfferFrom !== (isWhiteTurn ? "white" : "black")) {
        drawOfferFrom = null;
        drawAcceptedBy = null;
        drawBtn.textContent = "Offer Draw";
        drawBtn.classList.remove('draw-offered');
        
        // Update mobile button
        if (drawBtnMobile) {
          drawBtnMobile.classList.remove('draw-offered');
        }
        
        showAlert("Draw offer declined.");
        if (mobileDrawConfirm) {
          mobileDrawConfirm.classList.remove('show');
        }
      }
    });
  }

  if (newGameBtnMobile && newGameBtn) {
    newGameBtnMobile.addEventListener('click', () => newGameBtn.click());
    newGameBtnMobile.classList.add('danger');
  }

  if (timeControlBtnMobile) {
    timeControlBtnMobile.addEventListener('click', () => {
      mobileTimeModal.classList.add('show');
    });
  }

  if (mobileTimeClose) {
    mobileTimeClose.addEventListener('click', () => {
      mobileTimeModal.classList.remove('show');
    });
  }

  if (mobileTimeModal) {
    mobileTimeModal.addEventListener('click', (e) => {
      if (e.target === mobileTimeModal) {
        mobileTimeModal.classList.remove('show');
      }
    });
  }

  // Sync time select
  if (timeSelectMobile && timeSelect) {
    timeSelectMobile.value = timeSelect.value;
    timeSelectMobile.addEventListener('change', (e) => {
      timeSelect.value = e.target.value;
      timeSelect.dispatchEvent(new Event('change'));
      mobileTimeModal.classList.remove('show');
    });
    timeSelect.addEventListener('change', (e) => {
      timeSelectMobile.value = e.target.value;
    });
  }

  // Sync move list
  syncMobileMoveList();
  
  // Setup move navigation
  setupMoveNavigation();
}

function setupMoveNavigation() {
  const prevMoveBtn = document.getElementById('prevMoveBtn');
  const nextMoveBtn = document.getElementById('nextMoveBtn');
  
  if (prevMoveBtn) {
    prevMoveBtn.addEventListener('click', navigateToPreviousMove);
  }
  
  if (nextMoveBtn) {
    nextMoveBtn.addEventListener('click', navigateToNextMove);
  }
  
  updateNavigationButtons();
}

function navigateToPreviousMove() {
  if (currentViewIndex > -1) {
    currentViewIndex--;
    restorePositionToView(currentViewIndex);
    updateNavigationButtons();
  }
}

function navigateToNextMove() {
  if (currentViewIndex < moves.length - 1) {
    currentViewIndex++;
    restorePositionToView(currentViewIndex);
    updateNavigationButtons();
  }
}

function restorePositionToView(moveIndex) {
  // Save current viewing state
  isViewingHistory = moveIndex !== moves.length - 1;
  
  // Clear the board
  clearBoard();
  
  // Restore initial position
  restoreInitialPosition();
  
  // Apply moves up to the selected index
  for (let i = 0; i <= moveIndex; i++) {
    const move = moves[i];
    const fromSquare = document.getElementById(move.from);
    const toSquare = document.getElementById(move.to);
    const piece = fromSquare ? fromSquare.querySelector('.piece') : null;
    
    if (piece && toSquare) {
      // Move piece visually
      toSquare.appendChild(piece);
      
      // Update board array for display
      const fromIndex = boardSquaresArray.findIndex(sq => sq.squareId === move.from);
      const toIndex = boardSquaresArray.findIndex(sq => sq.squareId === move.to);
      
      if (fromIndex !== -1 && toIndex !== -1) {
        const targetPiece = boardSquaresArray[toIndex];
        
        // Handle captures
        if (targetPiece.pieceColor !== "blank" && targetPiece.pieceColor !== move.pieceColor) {
          // Remove captured piece visually
          const capturedPiece = toSquare.querySelector('.piece');
          if (capturedPiece && capturedPiece !== piece) {
            capturedPiece.remove();
          }
        }
        
        // Update board array
        boardSquaresArray[toIndex].pieceColor = move.pieceColor;
        boardSquaresArray[toIndex].pieceType = move.pieceType;
        boardSquaresArray[toIndex].pieceId = piece.id;
        boardSquaresArray[fromIndex].pieceColor = "blank";
        boardSquaresArray[fromIndex].pieceType = "blank";
        boardSquaresArray[fromIndex].pieceId = "blank";
      }
    }
  }
  
  // Update turn indicator based on move index
  if (moveIndex >= 0) {
    const lastMove = moves[moveIndex];
    isWhiteTurn = lastMove.pieceColor === "black"; // Next turn is opposite
  } else {
    isWhiteTurn = true;
  }
  
  // Clear selection and highlights
  clearSelection();
  clearMoveDots();
}

function clearBoard() {
  // Remove all pieces from board
  boardSquaresArray.forEach(sq => {
    const squareEl = document.getElementById(sq.squareId);
    if (squareEl) {
      const piece = squareEl.querySelector('.piece');
      if (piece) {
        piece.remove();
      }
    }
  });
}

function restoreInitialPosition() {
  // Reset board array to initial position
  boardSquaresArray = [];
  for (let i = 0; i < boardSquares.length; i++) {
    let row = 8 - Math.floor(i / 8);
    let column = String.fromCharCode(97 + (i % 8));
    let square = boardSquares[i];
    square.id = column + row;
    
    // Initial position setup
    const initialPieces = {
      'a8': { piece: 'rook', color: 'black' },
      'b8': { piece: 'knight', color: 'black' },
      'c8': { piece: 'bishop', color: 'black' },
      'd8': { piece: 'queen', color: 'black' },
      'e8': { piece: 'king', color: 'black' },
      'f8': { piece: 'bishop', color: 'black' },
      'g8': { piece: 'knight', color: 'black' },
      'h8': { piece: 'rook', color: 'black' },
      'a7': { piece: 'pawn', color: 'black' },
      'b7': { piece: 'pawn', color: 'black' },
      'c7': { piece: 'pawn', color: 'black' },
      'd7': { piece: 'pawn', color: 'black' },
      'e7': { piece: 'pawn', color: 'black' },
      'f7': { piece: 'pawn', color: 'black' },
      'g7': { piece: 'pawn', color: 'black' },
      'h7': { piece: 'pawn', color: 'black' },
      'a2': { piece: 'pawn', color: 'white' },
      'b2': { piece: 'pawn', color: 'white' },
      'c2': { piece: 'pawn', color: 'white' },
      'd2': { piece: 'pawn', color: 'white' },
      'e2': { piece: 'pawn', color: 'white' },
      'f2': { piece: 'pawn', color: 'white' },
      'g2': { piece: 'pawn', color: 'white' },
      'h2': { piece: 'pawn', color: 'white' },
      'a1': { piece: 'rook', color: 'white' },
      'b1': { piece: 'knight', color: 'white' },
      'c1': { piece: 'bishop', color: 'white' },
      'd1': { piece: 'queen', color: 'white' },
      'e1': { piece: 'king', color: 'white' },
      'f1': { piece: 'bishop', color: 'white' },
      'g1': { piece: 'knight', color: 'white' },
      'h1': { piece: 'rook', color: 'white' }
    };
    
    const squareId = square.id;
    if (initialPieces[squareId]) {
      const pieceInfo = initialPieces[squareId];
      const piece = document.createElement("div");
      piece.className = `piece ${pieceInfo.piece}`;
      piece.setAttribute("color", pieceInfo.color);
      piece.id = pieceInfo.piece + squareId;
      piece.setAttribute("draggable", true);
      piece.addEventListener("dragstart", drag);
      piece.addEventListener("dragend", function(ev) {
        clearMoveDots();
        ev.target.closest('.piece')?.classList.remove('moving');
      });
      piece.addEventListener("click", handlePieceClick);
      piece.addEventListener("touchstart", handlePieceTouch, { passive: false });
      
      const img = document.createElement("img");
      img.src = getImageForPiece(pieceInfo.color, pieceInfo.piece);
      img.alt = pieceInfo.piece;
      img.setAttribute("draggable", false);
      piece.appendChild(img);
      square.appendChild(piece);
      
      boardSquaresArray.push({
        squareId: squareId,
        pieceColor: pieceInfo.color,
        pieceType: pieceInfo.piece,
        pieceId: piece.id
      });
    } else {
      boardSquaresArray.push({
        squareId: squareId,
        pieceColor: "blank",
        pieceType: "blank",
        pieceId: "blank"
      });
    }
  }
}

function updateNavigationButtons() {
  const prevMoveBtn = document.getElementById('prevMoveBtn');
  const nextMoveBtn = document.getElementById('nextMoveBtn');
  
  if (prevMoveBtn) {
    prevMoveBtn.disabled = currentViewIndex <= -1 || moves.length === 0;
  }
  
  if (nextMoveBtn) {
    nextMoveBtn.disabled = currentViewIndex >= moves.length - 1;
  }
}

function syncMobileMoveList() {
  const moveList = document.getElementById('moveList');
  const moveListMobile = document.getElementById('moveListMobile');
  
  if (!moveList || !moveListMobile) return;

  // Observer to sync moves
  const observer = new MutationObserver(() => {
    moveListMobile.innerHTML = moveList.innerHTML;
    // Update styles for mobile
    moveListMobile.querySelectorAll('.move-list-item').forEach(item => {
      item.style.fontSize = '10px';
      item.style.padding = '4px 8px';
    });
  });

  observer.observe(moveList, { childList: true, subtree: true });
  
  // Initial sync
  moveListMobile.innerHTML = moveList.innerHTML;
}


/* ---------- MOBILE TOUCH HANDLERS FOR SQUARES (tap to move) ---------- */
function handleTouchStart(event) {
  // Don't prevent default - allow scrolling if not on a piece
  const square = event.currentTarget;
  const piece = square.querySelector('.piece');
  
  // Only prevent default if there's a piece and we might interact with it
  if (piece) {
    const pieceColor = piece.getAttribute("color");
    if ((isWhiteTurn && pieceColor === "white") || (!isWhiteTurn && pieceColor === "black")) {
      // This will be handled by handlePieceTouch
      return;
    }
  }
  
  touchStartSquare = square.id;
  touchStartTime = Date.now();
  isDragging = false;
}

function handleTouchMove(event) {
  // Allow scrolling - don't prevent default unless we're actually dragging a piece
  if (!draggedPiece) {
    return; // Allow normal scrolling
  }
  // If dragging a piece, preventDefault is handled in handlePieceDragMove
}

function handleTouchEnd(event) {
  // Only handle if we're not in the middle of a piece drag
  if (draggedPiece) {
    return; // Let handlePieceDragEnd handle it
  }
  
  const square = event.currentTarget;
  const squareId = square.id;
  const touchDuration = Date.now() - touchStartTime;
  
  // Only handle quick taps (not scrolls)
  if (touchDuration < 300 && !isDragging && touchStartSquare === squareId) {
    // If we have a selected piece and this square is a legal move, execute it
    if (selectedPiece && legalMoves.includes(squareId)) {
      const piece = document.getElementById(selectedPiece.pieceId);
      if (piece) {
        executeMove(selectedPiece.squareId, squareId, piece);
        clearSelection();
      }
    } else {
      // If no piece selected yet, try to select piece on this square
      const piece = square.querySelector('.piece');
      if (piece) {
        const pieceColor = piece.getAttribute("color");
        if ((isWhiteTurn && pieceColor === "white") || (!isWhiteTurn && pieceColor === "black")) {
          handlePieceClick({ currentTarget: piece, stopPropagation: () => {} });
        }
      } else {
        // Tap on empty square with no selection - clear selection
        clearSelection();
      }
    }
  }
  
  // Reset touch state
  touchStartSquare = null;
  isDragging = false;
  touchStartTime = 0;
}
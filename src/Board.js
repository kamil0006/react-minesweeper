import React, { useState } from 'react';
import { useEffect } from 'react';
import './Board.css';

const BOARD_SIZE = 10;
const MINES_COUNT = 3;

const generateBoard = () => {
	let board = Array(BOARD_SIZE)
		.fill()
		.map(() => Array(BOARD_SIZE).fill({ isMine: false, revealed: false, flagged: false, count: 0 }));

	// Losowanie min
	let minesPlaced = 0;
	while (minesPlaced < MINES_COUNT) {
		let x = Math.floor(Math.random() * BOARD_SIZE);
		let y = Math.floor(Math.random() * BOARD_SIZE);
		if (!board[x][y].isMine) {
			board[x][y] = { ...board[x][y], isMine: true };
			minesPlaced++;
		}
	}

	// Obliczanie liczb wokół min
	for (let x = 0; x < BOARD_SIZE; x++) {
		for (let y = 0; y < BOARD_SIZE; y++) {
			if (!board[x][y].isMine) {
				let count = 0;
				[-1, 0, 1].forEach(dx => {
					[-1, 0, 1].forEach(dy => {
						let nx = x + dx,
							ny = y + dy;
						if (
							!(dx === 0 && dy === 0) &&
							nx >= 0 &&
							ny >= 0 &&
							nx < BOARD_SIZE &&
							ny < BOARD_SIZE &&
							board[nx][ny].isMine
						) {
							count++;
						}
					});
				});
				board[x][y] = { ...board[x][y], count };
			}
		}
	}

	return board;
};

const revealAdjacent = (board, x, y) => {
	let newBoard = board.map(row => row.map(cell => ({ ...cell })));
	const queue = [[x, y]];
	const visited = new Set();

	while (queue.length > 0) {
		const [cx, cy] = queue.shift();
		const key = `${cx},${cy}`;
		if (visited.has(key) || newBoard[cx][cy].revealed) continue;

		newBoard[cx][cy].revealed = true;
		visited.add(key);

		if (newBoard[cx][cy].count === 0) {
			[-1, 0, 1].forEach(dx => {
				[-1, 0, 1].forEach(dy => {
					let nx = cx + dx,
						ny = cy + dy;
					if (nx >= 0 && ny >= 0 && nx < BOARD_SIZE && ny < BOARD_SIZE && !visited.has(`${nx},${ny}`)) {
						queue.push([nx, ny]);
					}
				});
			});
		}
	}
	return newBoard;
};

const Board = () => {
	const [board, setBoard] = useState(generateBoard());
	const [gameOver, setGameOver] = useState(false);
	const [gameMessage, setGameMessage] = useState('');
	const [time, setTime] = useState(0);
	const [isRunning, setIsRunning] = useState(false);

	useEffect(() => {
		let timer;
		if (isRunning && !gameOver) { // Licznik działa tylko, jeśli gra trwa
			timer = setInterval(() => {
				setTime(prevTime => prevTime + 1);
			}, 1000);
		} else {
			clearInterval(timer);
		}
		return () => clearInterval(timer);
	}, [isRunning, gameOver]);
	
	const revealCell = (x, y) => {
		if (!isRunning) {
			setIsRunning(true);
		}
		if (gameOver || board[x][y].revealed || board[x][y].flagged) return;
	
		let newBoard = board.map(row => row.map(cell => ({ ...cell })));
	
		if (newBoard[x][y].isMine) {
			setGameOver(true);
			setIsRunning(false); //  Zatrzymujemy licznik natychmiast po przegranej
			setGameMessage('💥 Game Over! 💥');
	
			// Odsłaniamy wszystkie miny po przegranej
			newBoard = newBoard.map(row => row.map(cell => (cell.isMine ? { ...cell, revealed: true } : cell)));
	
			setBoard(newBoard);
			return;
		} else {
			newBoard = revealAdjacent(newBoard, x, y);
		}
	
		setBoard(newBoard);
	
		if (checkWin(newBoard)) {
			setIsRunning(false); //  Zatrzymujemy licznik po wygranej
			newBoard = newBoard.map(row => row.map(cell => (cell.isMine ? { ...cell, revealed: true } : cell)));
			setBoard(newBoard);
			setGameMessage('🎉 Gratulacje! Wygrałeś! 🎉');
		}
	};

	// Sprawdzanie wygranej
	const checkWin = board => {
		for (let row of board) {
			for (let cell of row) {
				if (!cell.isMine && !cell.revealed) {
					return false; // Jeszcze nie odkryto wszystkich pól bez min
				}
			}
		}
		return true; // Wszystkie pola bez min są odsłonięte
	};

	const toggleFlag = (e, x, y) => {
		e.preventDefault(); // Blokujemy domyślne menu przeglądarki
		if (gameOver || board[x][y].revealed) return;

		let newBoard = board.map(row => row.map(cell => ({ ...cell })));
		newBoard[x][y].flagged = !newBoard[x][y].flagged;

		setBoard(newBoard);
	};

	const resetGame = () => {
		setBoard(generateBoard());
		setGameOver(false);
		setGameMessage('');
		setTime(0);
		setIsRunning(false); // Zatrzymanie stopera przy restarcie
	};

	return (
		<div className='board-container'>
			<h1>Minesweeper</h1>
			<button onClick={resetGame} className='reset-button'>
				{gameMessage && <div className='game-message'>{gameMessage}</div>}
				🔄 Restart
			</button>
			<p className="timer">⏳ Czas: {time}s</p>
			<div className='board'>
				{board.map((row, x) => (
					<div key={x} className='row'>
						{row.map((cell, y) => (
							<div
								key={y}
								className={`cell ${cell.revealed ? 'revealed' : ''} ${cell.isMine && gameOver ? 'mine' : ''}`}
								onClick={() => revealCell(x, y)}
								onContextMenu={e => toggleFlag(e, x, y)}
								data-count={cell.count}>
								{cell.flagged
									? '🚩'
									: cell.revealed || (gameOver && cell.isMine)
									? cell.isMine
										? '💣'
										: cell.count || ''
									: ''}
							</div>
						))}
					</div>
				))}
			</div>
		</div>
	);
};

export default Board;

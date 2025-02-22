import React, { useState, useEffect } from 'react';
import OpenAI from 'openai';
import './Board.css';

const openai = new OpenAI({
	apiKey: process.env.REACT_APP_OPENAI_API_KEY,
	dangerouslyAllowBrowser: true,
});

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

// Poprawione odsłanianie pustych pól (`count === 0`)
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
	const [aiRunning, setAiRunning] = useState(false);

	useEffect(() => {
		let timer;
		if (isRunning && !gameOver) {
			timer = setInterval(() => {
				setTime(prevTime => prevTime + 1);
			}, 1000);
		} else {
			clearInterval(timer);
		}
		return () => clearInterval(timer);
	}, [isRunning, gameOver]);

	const revealCell = (x, y) => {
		console.log(`🟢 AI próbuje kliknąć (${x}, ${y})`);

		if (!isRunning) {
			setIsRunning(true);
		}
		if (gameOver || board[x][y].revealed || board[x][y].flagged) return;

		let newBoard = board.map(row => row.map(cell => ({ ...cell })));

		if (newBoard[x][y].isMine) {
			setGameOver(true);
			setIsRunning(false);
			setGameMessage('💥 Game Over! 💥');
			newBoard = newBoard.map(row => row.map(cell => (cell.isMine ? { ...cell, revealed: true } : cell)));
			setBoard(newBoard);
			return;
		} else {
			newBoard = revealAdjacent(newBoard, x, y);
		}

		setBoard([...newBoard]); // Wymuszenie odświeżenia React
		if (checkWin(newBoard)) {
			setIsRunning(false);
			newBoard = newBoard.map(row => row.map(cell => (cell.isMine ? { ...cell, revealed: true } : cell)));
			setBoard(newBoard);
			setGameMessage('🎉 Gratulacje! Wygrałeś! 🎉');
		}
	};
	// Sprawdzanie wygranej
	const checkWin = () => {
		let allNonMinesRevealed = true;
		let allMinesFlagged = true;
	
		for (let row of board) {
			for (let cell of row) {
				if (!cell.isMine && !cell.revealed) {
					allNonMinesRevealed = false; // Jest jeszcze nieodkryte pole
				}
				if (cell.isMine && !cell.flagged) {
					allMinesFlagged = false; // Mina nie została oznaczona flagą
				}
			}
		}
	
		if (allNonMinesRevealed || allMinesFlagged) {
			console.log("🏆 AI wykryło wygraną!");
			setGameMessage("🎉 AI wygrało! 🎉");
			setAiRunning(false);
			return true;
		}
		return false;
	};
	
	

	const toggleFlag = (e, x, y) => {
		e.preventDefault(); // Blokujemy domyślne menu kontekstowe przeglądarki

		if (gameOver || board[x][y].revealed) return; // Nie można flagować odsłoniętych pól

		let newBoard = board.map(row => row.map(cell => ({ ...cell }))); // Kopiujemy planszę
		newBoard[x][y].flagged = !newBoard[x][y].flagged; // Przełączamy flagę

		setBoard([...newBoard]); // Wymuszamy odświeżenie Reacta
	};

	const flagMines = () => {
		let updatedBoard = board.map(row => row.map(cell => ({ ...cell })));
		let minesToFlag = [];
	
		for (let x = 0; x < BOARD_SIZE; x++) {
			for (let y = 0; y < BOARD_SIZE; y++) {
				if (updatedBoard[x][y].revealed && updatedBoard[x][y].count > 0) {
					let hiddenNeighbors = [];
					let flaggedCount = 0;
	
					for (let dx = -1; dx <= 1; dx++) {
						for (let dy = -1; dy <= 1; dy++) {
							let nx = x + dx, ny = y + dy;
							if (nx >= 0 && ny >= 0 && nx < BOARD_SIZE && ny < BOARD_SIZE) {
								if (!updatedBoard[nx][ny].revealed && !updatedBoard[nx][ny].flagged) {
									hiddenNeighbors.push([nx, ny]);
								} else if (updatedBoard[nx][ny].flagged) {
									flaggedCount++;
								}
							}
						}
					}
	
					// Jeśli liczba ukrytych pól = liczbie min wokół, to wszystkie te pola to miny
					if (hiddenNeighbors.length > 0 && hiddenNeighbors.length + flaggedCount === updatedBoard[x][y].count) {
						minesToFlag.push(...hiddenNeighbors);
					}
				}
			}
		}
	
		if (minesToFlag.length > 0) {
			minesToFlag.forEach(([fx, fy]) => {
				updatedBoard[fx][fy].flagged = true;
				console.log(`🚩 AI oznacza minę na (${fx}, ${fy})`);
			});
	
			setBoard(prevBoard => updatedBoard); // Teraz AI nie resetuje planszy!
			return true;
		}
	
		return false;
	};
	

	// Integracja AI
	const askOpenAI = async () => {
		console.log("✅ AI startuje i analizuje planszę...");
	
		if (gameOver) {
			console.log("⚠️ AI zatrzymane: gra zakończona.");
			setAiRunning(false);
			return;
		}
	
		// 🔹 Sprawdzamy, czy AI już wygrało po każdym ruchu
		if (checkWin()) {
			return; // AI przestaje działać, jeśli wykryło wygraną
		}
	
		// 🔹 AI najpierw sprawdza, czy może oznaczyć miny
		if (flagMines()) {
			setTimeout(() => {
				console.log("🔄 AI oznaczyło miny. Kontynuujemy...");
				askOpenAI();
			}, 500);
			return;
		}
	
		console.log("📡 Wysyłanie zapytania do OpenAI...");
	
	
	

		const prompt = `
			Jesteś AI grającym w Minesweeper. Oto aktualny stan planszy:
			${board.map(row => row.map(cell => (cell.revealed ? (cell.isMine ? '💣' : cell.count) : '?')).join(' ')).join('\n')}
			
			**Twoje zasady:**  
			- Jeśli na odkrytym polu liczba sąsiednich min = liczbie nieodkrytych pól wokół niego, oznacz je jako miny i NIE klikasz ich.  
			- Jeśli liczba oznaczonych min = liczbie podanej na polu, możesz odsłonić pozostałe sąsiadujące pola.  
			- Jeśli nie masz pewnego ruchu, zwróć "RANDOM X,Y", gdzie X i Y to zakryte pole.  
			- Ostatecznie zwróć najlepszy ruch w formacie "X,Y". 
			- Nie możesz samemu resetować planszy! 
			- Nie możesz wybierać już odkrytych pól!
		`;

		try {
			const response = await openai.chat.completions.create({
				model: 'gpt-4o-mini',
				messages: [{ role: 'system', content: prompt }],
				max_tokens: 10,
			});

			console.log('🔄 OpenAI odpowiedziało:', response);

			let move = response.choices?.[0]?.message?.content?.trim();
			console.log('🧠 AI wybrało ruch:', move);

			if (move.toUpperCase().startsWith('RANDOM')) {
				move = move.replace(/RANDOM\s*/, '');
			}

			let [x, y] = move.split(',').map(Number);

			if (isNaN(x) || isNaN(y)) {
				console.log('⚠️ OpenAI zwróciło błędne dane lub nie znalazło ruchu. Wybieram losowe pole...');

				let availableMoves = [];
				for (let i = 0; i < BOARD_SIZE; i++) {
					for (let j = 0; j < BOARD_SIZE; j++) {
						if (!board[i][j].revealed && !board[i][j].flagged) {
							availableMoves.push([i, j]);
						}
					}
				}

				if (availableMoves.length > 0) {
					[x, y] = availableMoves[Math.floor(Math.random() * availableMoves.length)];
					console.log('🎲 AI losowo klika:', x, y);
				} else {
					console.log('🏁 Nie ma dostępnych ruchów. AI się zatrzymuje.');
					setAiRunning(false);
					return;
				}
			}

			console.log('🎯 AI klika:', x, y);
			revealCell(x, y);

			setTimeout(() => {
				console.log('🔄 AI wykonuje kolejny ruch...');
				askOpenAI();
			}, 500);
		} catch (error) {
			console.error('❌ Błąd komunikacji z OpenAI:', error);
			setAiRunning(false);
		}
	};

	const startAI = () => {
		if (gameOver || aiRunning) {
			console.log('⚠️ AI nie może się uruchomić: gameOver =', gameOver, ', aiRunning =', aiRunning);
			return;
		}
		console.log('🤖 AI uruchomione!');
		setAiRunning(true);
		askOpenAI();
	};

	const resetGame = () => {
		setBoard(generateBoard());
		setGameOver(false);
		setGameMessage('');
		setTime(0);
		setIsRunning(false);
		setAiRunning(false);
	};

	return (
		<div className='board-container'>
			<h1>Minesweeper</h1>
			<button onClick={resetGame} className='reset-button'>
				🔄 Restart
			</button>
			<button onClick={startAI} className='ai-button'>
				🤖 Start AI
			</button>

			{gameMessage && <h2 className='game-message'>{gameMessage}</h2>}
			<p className='timer'>⏳ Czas: {time}s</p>
			<div className='board'>
				{board.map((row, x) => (
					<div key={x} className='row'>
						{row.map((cell, y) => (
							<div
								key={y}
								className={`cell ${cell.revealed ? 'revealed' : ''} ${cell.isMine && gameOver ? 'mine' : ''}`}
								onClick={() => revealCell(x, y)}
								onContextMenu={e => toggleFlag(e, x, y)} // Dodajemy obsługę prawego kliknięcia
								data-count={cell.count}>
								{cell.flagged ? '🚩' : cell.revealed ? (cell.isMine ? '💣' : cell.count || '') : ''}
							</div>
						))}
					</div>
				))}
			</div>
		</div>
	);
};

export default Board;

import React, { useState, useEffect } from 'react';
import OpenAI from 'openai';
import './Board.css';

const openai = new OpenAI({
	apiKey: process.env.REACT_APP_OPENAI_API_KEY,
	dangerouslyAllowBrowser: true,
});

const BOARD_SIZE = 10;
const MINES_COUNT = 13;

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

		// 🔹 Sprawdzamy wygraną na nowej planszy przed jej zapisaniem do stanu
		if (checkWin(newBoard)) {
			console.log('🏆 Gra wygrana! Wszystkie pola bez min są odkryte.');
			setGameMessage('🎉 Gratulacje! Wygrałeś! 🎉');
			setIsRunning(false);
			setGameOver(true);
		}

		setBoard(newBoard); // Aktualizujemy stan planszy
	};

	// Sprawdzanie wygranej
	const checkWin = (currentBoard = board) => {
		if (!Array.isArray(currentBoard)) {
			console.error('❌ Błąd: przekazano niepoprawną planszę do checkWin()', currentBoard);
			return false;
		}

		let allNonMinesRevealed = true;
		let allMinesFlagged = true;

		for (let row of currentBoard) {
			for (let cell of row) {
				if (!cell.isMine && !cell.revealed) {
					allNonMinesRevealed = false; // Jeśli istnieje zakryte pole bez miny, gra jeszcze trwa
				}
				if (cell.isMine && !cell.flagged) {
					allMinesFlagged = false; // Jeśli jakaś mina nie jest oznaczona, gra jeszcze trwa
				}
			}
		}

		if (allNonMinesRevealed || allMinesFlagged) {
			console.log('🏆 Gra wygrana! Wszystkie pola bez min są odkryte lub miny są poprawnie oznaczone.');
			setGameMessage('🎉 Wygrałeś! 🎉');
			setAiRunning(false);
			setIsRunning(false); // ⏳ Zatrzymanie czasu po wygranej
			setGameOver(true);
			return true;
		}

		return false;
	};

	const toggleFlag = (e, x, y) => {
		e.preventDefault(); // Blokujemy domyślne menu kontekstowe

		if (gameOver || board[x][y].revealed) return;

		let newBoard = board.map(row => row.map(cell => ({ ...cell })));
		newBoard[x][y].flagged = !newBoard[x][y].flagged; // Przełączamy flagę

		setBoard(newBoard); // Aktualizujemy stan planszy

		// 🔹 Sprawdzamy wygraną po KAŻDEJ zmianie flagi
		setTimeout(() => {
			if (checkWin(newBoard)) {
				setAiRunning(false);
			}
		}, 100);
	};

	const getRandomMove = () => {
		let availableMoves = [];

		for (let x = 0; x < BOARD_SIZE; x++) {
			for (let y = 0; y < BOARD_SIZE; y++) {
				if (!board[x][y].revealed && !board[x][y].flagged) {
					availableMoves.push([x, y]);
				}
			}
		}

		if (availableMoves.length === 0) {
			console.error('⚠️ Brak dostępnych ruchów! AI kończy grę.');
			setAiRunning(false);
			return '0,0';
		}

		let [rx, ry] = availableMoves[Math.floor(Math.random() * availableMoves.length)];
		console.log(`🎲 AI wybiera losowe pole: (${rx}, ${ry})`);
		return `${rx},${ry}`;
	};

	const getSafestMove = () => {
		let bestMove = null;
		let minRisk = Infinity;

		for (let x = 0; x < BOARD_SIZE; x++) {
			for (let y = 0; y < BOARD_SIZE; y++) {
				if (!board[x][y].revealed && !board[x][y].flagged) {
					let surroundingMines = 0;
					let surroundingCovered = 0;

					[-1, 0, 1].forEach(dx => {
						[-1, 0, 1].forEach(dy => {
							let nx = x + dx,
								ny = y + dy;
							if (nx >= 0 && ny >= 0 && nx < BOARD_SIZE && ny < BOARD_SIZE) {
								if (board[nx][ny].isMine) surroundingMines++;
								if (!board[nx][ny].revealed) surroundingCovered++;
							}
						});
					});

					let riskFactor = surroundingMines + surroundingCovered;

					if (riskFactor < minRisk) {
						minRisk = riskFactor;
						bestMove = [x, y];
					}
				}
			}
		}

		if (!bestMove) {
			console.warn('⚠️ AI nie znalazło bezpiecznego ruchu – wybiera losowe pole.');
			return getRandomMove();
		}

		console.log(`🛡️ AI wybiera najbezpieczniejsze pole: (${bestMove[0]}, ${bestMove[1]})`);
		return `${bestMove[0]},${bestMove[1]}`;
	};

	const handleAIFailure = () => {
		console.warn("⚠️ OpenAI nie odpowiedziało – AI wybiera bezpieczny lub losowy ruch.");
	
		if (gameOver || checkWin()) { 
			console.log("🏁 AI zatrzymane po zakończeniu gry.");
			setAiRunning(false);
			return;
		}
	
		let move = getSafestMove(); 
	
		if (!move) {
			console.warn("⚠️ AI nie znalazło żadnego bezpiecznego pola – wybiera losowy ruch.");
			move = getRandomMove();
		}
	
		let [x, y] = move.split(',').map(Number);
	
		console.log("🎯 AI klika:", x, y);
		revealCell(x, y);
	
		setTimeout(() => {
			if (!gameOver && !checkWin()) {
				console.log("🔄 AI wykonuje kolejny ruch...");
				askOpenAI();
			} else {
				console.log("🏁 AI zakończyło działanie.");
				setAiRunning(false);
			}
		}, 500);
	};
	

	const generatePrompt = () => {
		return `
			Jesteś **ekspertem w grze Minesweeper**. Twoim zadaniem jest grać **jak doświadczony gracz**, używając **logiki i analizy prawdopodobieństwa**.
	
			**🔹 Oto zasady twojej strategii:**
			1️⃣ **Flaga pewnych min:**  
				- Jeśli liczba zakrytych sąsiadów = liczbie na polu, oznacz je jako miny 🚩.  
			2️⃣ **Odsłanianie pewnych pól:**  
				- Jeśli liczba oznaczonych min wokół pola = liczbie na polu, odkryj pozostałe pola.  
			3️⃣ **Analiza ryzyka:**  
				- Jeśli nie masz pewnego ruchu, **znajdź pole z najmniejszym prawdopodobieństwem miny** i kliknij je.  
			4️⃣ **Zgadywanie (w ostateczności):**  
				- Jeśli nie możesz obliczyć ruchu, wybierz **najbezpieczniejsze pole w otwartym obszarze**.  
			5️⃣ **Nigdy nie klikaj pola, które może być miną, jeśli masz inną opcję!**  
	
			**🔹 Aktualna plansza:**
			- **?** = Zakryte pole  
			- **🚩** = Flaga (oznaczona mina)  
			- **💣** = Mina  
			- **Cyfra** = Liczba min w sąsiedztwie  
	
			**🔹 Twoje zadanie:**  
			- Zwróć najlepszy możliwy ruch w formacie X,Y (np. 3,4).  
			- Jeśli musisz oznaczyć minę, zwróć FLAG X,Y.  
			- Nie podawaj dodatkowych informacji  tylko ruch.
	
			**🟢 Aktualna sytuacja na planszy:**  
			${board
				.map(row =>
					row.map(cell => (cell.revealed ? (cell.isMine ? '💣' : cell.flagged ? '🚩' : cell.count) : '?')).join(' ')
				)
				.join('\n')}
		`;
	};

	let moveCounter = 0; // Licznik ruchów AI, aby unikać zapętlenia

	const askOpenAI = async () => {
		console.log("✅ AI startuje i analizuje planszę...");
	
		if (gameOver || checkWin()) { 
			console.log("🏁 AI zakończyło działanie. Gra się skończyła.");
			setAiRunning(false);
			return;
		}
	
		moveCounter++;
		if (moveCounter > 50) {
			console.error("⚠️ AI wykonało za dużo ruchów – zatrzymuje się.");
			setAiRunning(false);
			return;
		}
	
		console.log("📡 Wysyłanie zapytania do OpenAI...");
	
		let aiTimeout = setTimeout(() => {
			console.warn("⏳ AI za długo myśli – wybiera bezpieczny ruch.");
			handleAIFailure();
		}, 2500); // AI ma maksymalnie 2.5 sekundy na decyzję
	
		try {
			const response = await openai.chat.completions.create({
				model: 'gpt-4o-mini',
				messages: [{ role: 'system', content: generatePrompt() }],
				max_tokens: 10,
			});
	
			clearTimeout(aiTimeout); 
	
			console.log("🔄 OpenAI odpowiedziało:", response);
	
			let move = response.choices?.[0]?.message?.content?.trim();
			console.log("🧠 AI wybrało ruch:", move);
	
			if (!move || (!move.includes(",") && !move.includes("FLAG"))) {
				console.warn("⚠️ OpenAI zwróciło błędne dane lub brak ruchu. AI wybiera losowy ruch.");
				handleAIFailure();
				return;
			}
	
			if (gameOver || checkWin()) { 
				console.log("🏁 AI zatrzymane po zakończeniu gry.");
				setAiRunning(false);
				return;
			}
	
			if (move.includes("FLAG")) {
				let parts = move.split(' ');
				let x = parseInt(parts[1]);
				let y = parseInt(parts[2]);
	
				console.log(`🚩 AI oznacza minę: (${x}, ${y})`);
				toggleFlag(null, x, y);
			} else {
				let [x, y] = move.split(',').map(Number);
				if (isNaN(x) || isNaN(y) || board[x][y].revealed || board[x][y].flagged) {
					console.error("❌ OpenAI zwróciło niepoprawne lub już odkryte pole. AI wybiera bezpieczny ruch.");
					handleAIFailure();
					return;
				}
				console.log("🎯 AI klika:", x, y);
				revealCell(x, y);
			}
	
			setTimeout(() => {
				if (!gameOver && !checkWin()) {
					console.log("🔄 AI wykonuje kolejny ruch...");
					askOpenAI();
				} else {
					console.log("🏁 AI zakończyło działanie.");
					setAiRunning(false);
				}
			}, 500);
	
		} catch (error) {
			console.error("❌ Błąd komunikacji z OpenAI:", error);
			handleAIFailure();
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
		console.log('🔄 Resetowanie gry...');
		setBoard(generateBoard()); // Tworzymy nową planszę
		setGameOver(false);
		setGameMessage('');
		setTime(0);
		setIsRunning(false);
		setAiRunning(false);
		moveCounter = 0; // Resetujemy licznik ruchów AI
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

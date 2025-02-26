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
				for (let dx = -1; dx <= 1; dx++) {
					for (let dy = -1; dy <= 1; dy++) {
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
					}
				}
				board[x][y] = { ...board[x][y], count };
			}
		}
	}

	return board;
};

// Usprawniona funkcja odsłaniania pustych pól
const revealAdjacent = (board, x, y) => {
	let newBoard = board.map(row => row.map(cell => ({ ...cell })));
	const queue = [[x, y]];
	const visited = new Set();

	while (queue.length > 0) {
		const [cx, cy] = queue.shift();
		const key = `${cx},${cy}`;
		if (visited.has(key)) continue;

		newBoard[cx][cy].revealed = true;
		visited.add(key);

		// Dla pustych pól (count === 0) sprawdzamy sąsiadów
		if (newBoard[cx][cy].count === 0) {
			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					let nx = cx + dx,
						ny = cy + dy;
					if (
						nx >= 0 && 
						ny >= 0 && 
						nx < BOARD_SIZE && 
						ny < BOARD_SIZE && 
						!newBoard[nx][ny].revealed && 
						!newBoard[nx][ny].flagged
					) {
						queue.push([nx, ny]);
					}
				}
			}
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
	const [flagCount, setFlagCount] = useState(0); // Dodajemy licznik flag
	const [firstMove, setFirstMove] = useState(true); // Dodajemy flagę pierwszego ruchu

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

	// Funkcja do generowania bezpiecznego pierwszego ruchu
	const generateSafeFirstMove = (clickX, clickY) => {
		let newBoard;
		let isValidBoard = false;

		// Generujemy planszę dopóki nie będzie miała pustego pola w miejscu pierwszego kliknięcia
		while (!isValidBoard) {
			newBoard = generateBoard();
			if (!newBoard[clickX][clickY].isMine && newBoard[clickX][clickY].count === 0) {
				isValidBoard = true;
			}
		}

		return newBoard;
	};

	const revealCell = (x, y) => {
		if (gameOver || board[x][y].revealed || board[x][y].flagged) return;

		if (!isRunning) {
			setIsRunning(true);
		}

		// Sprawdzenie pierwszego ruchu
		if (firstMove) {
			setFirstMove(false);
			
			// Jeśli pierwszy ruch trafił na minę lub liczbę, generujemy nową planszę z pustym polem w miejscu kliknięcia
			if (board[x][y].isMine || board[x][y].count > 0) {
				const safeBoard = generateSafeFirstMove(x, y);
				setBoard(safeBoard);
				
				// Wykorzystujemy nową planszę do odsłonięcia pola
				const newBoard = revealAdjacent(safeBoard, x, y);
				setBoard(newBoard);
				return;
			}
		}

		let newBoard = board.map(row => row.map(cell => ({ ...cell })));

		if (newBoard[x][y].isMine) {
			// Przegraliśmy - odkrywamy wszystkie miny
			setGameOver(true);
			setIsRunning(false);
			setGameMessage('💥 Game Over! 💥');
			newBoard = newBoard.map(row => 
				row.map(cell => 
					cell.isMine ? { ...cell, revealed: true } : cell
				)
			);
			setBoard(newBoard);
			return;
		} else {
			// Odsłaniamy puste pola
			newBoard = revealAdjacent(newBoard, x, y);
		}

		// Sprawdzamy wygraną
		if (checkWin(newBoard)) {
			console.log('🏆 Gra wygrana! Wszystkie pola bez min są odkryte.');
			setGameMessage('🎉 Gratulacje! Wygrałeś! 🎉');
			setIsRunning(false);
			setGameOver(true);
			
			// Oznaczamy wszystkie pozostałe miny flagami
			newBoard = newBoard.map(row => 
				row.map(cell => 
					cell.isMine && !cell.flagged ? { ...cell, flagged: true } : cell
				)
			);
		}

		setBoard(newBoard);
	};

	// Usprawnione sprawdzanie wygranej
	const checkWin = (currentBoard = board) => {
		if (!Array.isArray(currentBoard)) {
			console.error('❌ Błąd: przekazano niepoprawną planszę do checkWin()', currentBoard);
			return false;
		}

		// Sprawdzamy czy wszystkie pola bez min są odkryte
		for (let x = 0; x < BOARD_SIZE; x++) {
			for (let y = 0; y < BOARD_SIZE; y++) {
				if (!currentBoard[x][y].isMine && !currentBoard[x][y].revealed) {
					return false; // Znaleziono nieodkryte pole bez miny
				}
			}
		}
		
		return true; // Wszystkie pola bez min są odkryte
	};

	const toggleFlag = (e, x, y) => {
		if (e) e.preventDefault(); // Blokujemy domyślne menu kontekstowe

		if (gameOver || board[x][y].revealed) return;

		let newBoard = board.map(row => row.map(cell => ({ ...cell })));
		const newFlagValue = !newBoard[x][y].flagged;
		
		// Aktualizacja licznika flag
		if (newFlagValue) {
			setFlagCount(prev => prev + 1);
		} else {
			setFlagCount(prev => prev - 1);
		}
		
		newBoard[x][y].flagged = newFlagValue;
		setBoard(newBoard);

		// Sprawdzamy wygraną po dodaniu flagi
		if (checkWin(newBoard)) {
			setGameMessage('🎉 Gratulacje! Wygrałeś! 🎉');
			setIsRunning(false);
			setGameOver(true);
			setAiRunning(false);
		}
	};

	// Usprawniona funkcja znajdowania najbezpieczniejszego ruchu
	const getSafestMove = () => {
		// Krok 1: Identyfikacja pewnych ruchów opartych na logice sapera
		const safeMovesInfo = findCertainMoves();
		
		if (safeMovesInfo.safeCells.length > 0) {
			const [x, y] = safeMovesInfo.safeCells[0];
			console.log(`🛡️ AI znalazło pewne bezpieczne pole: (${x}, ${y})`);
			return `${x},${y}`;
		}
		
		if (safeMovesInfo.mineCells.length > 0) {
			const [x, y] = safeMovesInfo.mineCells[0];
			console.log(`🚩 AI znalazło pewną minę: (${x}, ${y})`);
			return `FLAG ${x} ${y}`;
		}
		
		// Krok 2: Jeśli nie ma pewnych ruchów, obliczamy prawdopodobieństwa
		let bestMove = null;
		let minRisk = Infinity;

		for (let x = 0; x < BOARD_SIZE; x++) {
			for (let y = 0; y < BOARD_SIZE; y++) {
				if (!board[x][y].revealed && !board[x][y].flagged) {
					// Ustal ryzyko ruchu na podstawie analizy sąsiadów
					const risk = calculateRisk(x, y);
					
					if (risk < minRisk) {
						minRisk = risk;
						bestMove = [x, y];
					}
				}
			}
		}

		if (!bestMove) {
			console.warn('⚠️ AI nie znalazło bezpiecznego ruchu – wybiera losowe pole.');
			return getRandomMove();
		}

		console.log(`🛡️ AI wybiera najbezpieczniejsze pole: (${bestMove[0]}, ${bestMove[1]}) z ryzykiem: ${minRisk.toFixed(2)}`);
		return `${bestMove[0]},${bestMove[1]}`;
	};

	// Nowa funkcja do obliczania ryzyka ruchu
	const calculateRisk = (x, y) => {
		// Sprawdzamy sąsiedztwo dla odsłoniętych pól
		let totalRisk = 0;
		let relevantNeighbors = 0;
		
		for (let dx = -2; dx <= 2; dx++) {
			for (let dy = -2; dy <= 2; dy++) {
				const nx = x + dx;
				const ny = y + dy;
				
				if (nx >= 0 && ny >= 0 && nx < BOARD_SIZE && ny < BOARD_SIZE && board[nx][ny].revealed) {
					// Obliczamy ryzyko na podstawie liczby min w pobliżu pola
					const distance = Math.max(Math.abs(dx), Math.abs(dy));
					const weight = 1 / distance; // Im bliżej, tym większa waga
					
					const cell = board[nx][ny];
					if (cell.count > 0) {
						// Liczymy sąsiadów tego pola
						let flaggedNeighbors = 0;
						let uncoveredNeighbors = 0;
						
						for (let ndx = -1; ndx <= 1; ndx++) {
							for (let ndy = -1; ndy <= 1; ndy++) {
								const nnx = nx + ndx;
								const nny = ny + ndy;
								
								if (nnx >= 0 && nny >= 0 && nnx < BOARD_SIZE && nny < BOARD_SIZE) {
									if (board[nnx][nny].flagged) {
										flaggedNeighbors++;
									} else if (!board[nnx][nny].revealed) {
										uncoveredNeighbors++;
									}
								}
							}
						}
						
						// Jeśli pole jest wśród nieodkrytych sąsiadów pola z cyfrą
						if (Math.abs(x - nx) <= 1 && Math.abs(y - ny) <= 1) {
							const remainingMines = cell.count - flaggedNeighbors;
							if (remainingMines > 0 && uncoveredNeighbors > 0) {
								const localRisk = weight * (remainingMines / uncoveredNeighbors);
								totalRisk += localRisk;
								relevantNeighbors++;
							}
						}
					}
				}
			}
		}
		
		// Jeśli nie znaleziono żadnych informacji, zakładamy średnie ryzyko
		if (relevantNeighbors === 0) {
			return 0.5; // Neutralne ryzyko
		}
		
		return totalRisk / relevantNeighbors;
	};

	// Nowa funkcja do identyfikacji pewnych ruchów na podstawie logiki sapera
	const findCertainMoves = () => {
		const safeCells = [];
		const mineCells = [];
		
		// Sprawdzamy każde odkryte pole z liczbą
		for (let x = 0; x < BOARD_SIZE; x++) {
			for (let y = 0; y < BOARD_SIZE; y++) {
				if (board[x][y].revealed && board[x][y].count > 0) {
					// Zbieramy informacje o sąsiadach
					const neighbors = [];
					let flaggedCount = 0;
					let unrevealedCount = 0;
					
					for (let dx = -1; dx <= 1; dx++) {
						for (let dy = -1; dy <= 1; dy++) {
							if (dx === 0 && dy === 0) continue;
							
							const nx = x + dx;
							const ny = y + dy;
							
							if (nx >= 0 && ny >= 0 && nx < BOARD_SIZE && ny < BOARD_SIZE) {
								if (board[nx][ny].flagged) {
									flaggedCount++;
								} else if (!board[nx][ny].revealed) {
									unrevealedCount++;
									neighbors.push([nx, ny]);
								}
							}
						}
					}
					
					// Pewna flaga: Jeśli liczba nieodkrytych pól = liczbie min (liczba - flagi)
					if (unrevealedCount > 0 && board[x][y].count - flaggedCount === unrevealedCount) {
						// Wszystkie nieodkryte pola są minami
						neighbors.forEach(([nx, ny]) => {
							// Sprawdzamy czy ta mina jest już na liście mineCells
							if (!mineCells.some(([mx, my]) => mx === nx && my === ny)) {
								mineCells.push([nx, ny]);
							}
						});
					}
					
					// Pewne bezpieczne pola: Jeśli liczba oflagowanych pól = liczbie
					if (unrevealedCount > 0 && board[x][y].count === flaggedCount) {
						// Wszystkie pozostałe nieodkryte pola są bezpieczne
						neighbors.forEach(([nx, ny]) => {
							// Sprawdzamy czy to bezpieczne pole jest już na liście safeCells
							if (!safeCells.some(([sx, sy]) => sx === nx && sy === ny)) {
								safeCells.push([nx, ny]);
							}
						});
					}
				}
			}
		}
		
		return { safeCells, mineCells };
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
			return null;
		}

		let [rx, ry] = availableMoves[Math.floor(Math.random() * availableMoves.length)];
		console.log(`🎲 AI wybiera losowe pole: (${rx}, ${ry})`);
		return `${rx},${ry}`;
	};

	const handleAIFailure = () => {
		console.warn("⚠️ OpenAI nie odpowiedziało – AI używa własnej logiki.");
	
		if (gameOver || checkWin()) { 
			console.log("🏁 AI zatrzymane po zakończeniu gry.");
			setAiRunning(false);
			return;
		}
	
		// Używamy usprawnionej logiki zamiast losowego ruchu
		let move = getSafestMove(); 
	
		if (!move) {
			console.warn("⚠️ AI nie znalazło żadnego ruchu – kończy działanie");
			setAiRunning(false);
			return;
		}
	
		// Wykonanie ruchu
		if (move.includes("FLAG")) {
			let parts = move.split(' ');
			let x = parseInt(parts[1]);
			let y = parseInt(parts[2]);
	
			console.log(`🚩 AI oznacza minę: (${x}, ${y})`);
			toggleFlag(null, x, y);
		} else {
			let [x, y] = move.split(',').map(Number);
			console.log(`🎯 AI klika: (${x}, ${y})`);
			revealCell(x, y);
		}
	
		// Planujemy kolejny ruch AI
		setTimeout(() => {
			if (!gameOver && !checkWin() && aiRunning) {
				console.log("🔄 AI wykonuje kolejny ruch...");
				askOpenAI();
			} else {
				console.log("🏁 AI zakończyło działanie.");
				setAiRunning(false);
			}
		}, 500);
	};

	// Ulepszony prompt dla OpenAI
	const generatePrompt = () => {
		// Przygotowanie wizualizacji planszy
		let boardRepresentation = "";
		for (let x = 0; x < BOARD_SIZE; x++) {
			let rowStr = "";
			for (let y = 0; y < BOARD_SIZE; y++) {
				const cell = board[x][y];
				if (cell.revealed) {
					rowStr += cell.count === 0 ? "·" : cell.count;
				} else if (cell.flagged) {
					rowStr += "F";
				} else {
					rowStr += "?";
				}
				rowStr += " ";
			}
			boardRepresentation += rowStr.trim() + "\n";
		}
		
		return `
			Jesteś **ekspertem w grze Minesweeper (Saper)**. Twoim zadaniem jest znalezienie najbezpieczniejszego ruchu.
			Plansza ma wymiary ${BOARD_SIZE}x${BOARD_SIZE} i zawiera ${MINES_COUNT} min.
			
			**Oznaczenia na planszy:**
			- **?** = Nieodkryte pole
			- **F** = Oznaczona flaga (przypuszczalna mina)
			- **·** = Odkryte puste pole (bez min w pobliżu)
			- **1-8** = Liczba min w sąsiedztwie (8 sąsiednich pól)
			
			**Algorytm wnioskowania:**
			1. Jeśli wszystkie nieodkryte pola wokół liczby są minami, oznacz je flagami.
			2. Jeśli liczba flag wokół pola = liczbie na tym polu, pozostałe sąsiednie pola są bezpieczne.
			3. Stosuj przekrojową analizę sąsiadujących liczb, aby wnioskować o pozycji min.
			4. Używaj prawdopodobieństwa, gdy pewne wnioskowanie nie jest możliwe.
			
			**Aktualna plansza (współrzędne [x,y] od [0,0] do [${BOARD_SIZE-1},${BOARD_SIZE-1}]):**
			${boardRepresentation}
			
			**Zwróć TYLKO jeden z formatów:**
			1. "x,y" - aby odkryć bezpieczne pole (np. "3,4")
			2. "FLAG x y" - aby oznaczyć minę (np. "FLAG 2 7")
			
			Twoja odpowiedź powinna zawierać TYLKO współrzędne, bez żadnych dodatkowych wyjaśnień.
		`;
	};

	let moveCounter = 0; // Licznik ruchów AI, aby unikać zapętlenia

	const askOpenAI = async () => {
		if (gameOver || checkWin() || !aiRunning) { 
			setAiRunning(false);
			return;
		}
	
		moveCounter++;
		if (moveCounter > 50) {
			console.error("⚠️ AI wykonało za dużo ruchów – zatrzymuje się.");
			setAiRunning(false);
			return;
		}
	
		// Ustawiamy timeout na wypadek problemu z API
		let aiTimeout = setTimeout(() => {
			console.warn("⏳ AI za długo myśli – używa własnej logiki.");
			handleAIFailure();
		}, 3000); // Zwiększamy czas na decyzję
	
		try {
			const response = await openai.chat.completions.create({
				model: 'gpt-4o-mini', // Można też użyć lepszego modelu jak gpt-4o
				messages: [
					{ role: 'system', content: generatePrompt() },
					// Dodajemy przykład instruujący model o oczekiwanym formacie
					{ role: 'user', content: 'Wybierz najbezpieczniejszy ruch.' },
					{ role: 'assistant', content: '2,3' } // Przykład oczekiwanej odpowiedzi
				],
				temperature: 0.3, // Niższa temperatura dla bardziej deterministycznych odpowiedzi
				max_tokens: 10,
			});
	
			clearTimeout(aiTimeout);
	
			let move = response.choices?.[0]?.message?.content?.trim();
			console.log("🧠 AI wybrało ruch:", move);
	
			if (!move || (!move.includes(",") && !move.includes("FLAG"))) {
				console.warn("⚠️ OpenAI zwróciło błędne dane. AI używa własnej logiki.");
				handleAIFailure();
				return;
			}
	
			if (gameOver || checkWin() || !aiRunning) { 
				console.log("🏁 AI zatrzymane - gra się zakończyła.");
				setAiRunning(false);
				return;
			}
	
			// Wykonanie ruchu
			if (move.toLowerCase().includes("flag")) {
				let parts = move.split(/\s+/);
				let x = parseInt(parts[1]);
				let y = parseInt(parts[2]);
	
				console.log(`🚩 AI oznacza minę: (${x}, ${y})`);
				if (isNaN(x) || isNaN(y) || x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) {
					console.error("❌ OpenAI zwróciło niepoprawne współrzędne flagi. AI używa własnej logiki.");
					handleAIFailure();
					return;
				}
				
				toggleFlag(null, x, y);
			} else {
				let coords = move.split(/[,\s]+/).map(Number);
				let x = coords[0];
				let y = coords[1];
				
				if (isNaN(x) || isNaN(y) || x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE || 
					board[x][y].revealed || board[x][y].flagged) {
					console.error("❌ OpenAI zwróciło niepoprawne pole. AI używa własnej logiki.");
					handleAIFailure();
					return;
				}
				
				console.log(`🎯 AI klika: (${x}, ${y})`);
				revealCell(x, y);
			}
	
			// Planujemy kolejny ruch AI
			setTimeout(() => {
				if (!gameOver && !checkWin() && aiRunning) {
					console.log("🔄 AI wykonuje kolejny ruch...");
					askOpenAI();
				} else {
					console.log("🏁 AI zakończyło działanie.");
					setAiRunning(false);
				}
			}, 500);
	
		} catch (error) {
			console.error("❌ Błąd komunikacji z OpenAI:", error);
			clearTimeout(aiTimeout);
			handleAIFailure();
		}
	};

	const startAI = () => {
		if (gameOver || aiRunning) return;
		
		setAiRunning(true);
		moveCounter = 0;
		
		// Jeśli jest to pierwszy ruch w grze, AI wybiera losowe pole w narożniku lub na środku
		if (firstMove) {
			const cornerMoves = [[0, 0], [0, BOARD_SIZE-1], [BOARD_SIZE-1, 0], [BOARD_SIZE-1, BOARD_SIZE-1]];
			const centerMove = [Math.floor(BOARD_SIZE/2), Math.floor(BOARD_SIZE/2)];
			
			// Losujemy między narożnikiem a środkiem (kąty są zazwyczaj bezpieczniejsze)
			const [x, y] = Math.random() > 0.5 ? 
				cornerMoves[Math.floor(Math.random() * cornerMoves.length)] : 
				centerMove;
				
			console.log(`🎮 AI wykonuje pierwszy ruch: (${x}, ${y})`);
			revealCell(x, y);
			
			// Planujemy kolejny ruch po krótkim opóźnieniu
			setTimeout(() => {
				if (!gameOver && !checkWin() && aiRunning) {
					askOpenAI();
				}
			}, 500);
		} else {
			// Jeśli gra jest już w toku, używamy OpenAI
			askOpenAI();
		}
	};

	const resetGame = () => {
		setBoard(generateBoard());
		setGameOver(false);
		setGameMessage('');
		setTime(0);
		setIsRunning(false);
		setAiRunning(false);
		setFlagCount(0);
		setFirstMove(true);
		moveCounter = 0;
	};

	return (
		<div className='board-container'>
			<h1>Minesweeper</h1>
			<div className='game-info'>
				<p className='timer'>⏳ Czas: {time}s</p>
				<p className='flag-counter'>🚩 Flagi: {flagCount}/{MINES_COUNT}</p>
			</div>
			
			<div className='controls'>
				<button onClick={resetGame} className='reset-button'>
					🔄 Restart
				</button>
				<button 
					onClick={startAI} 
					className='ai-button'
					disabled={gameOver || aiRunning}>
					{aiRunning ? '🤖 AI pracuje...' : '🤖 Start AI'}
				</button>
			</div>

			{gameMessage && <h2 className='game-message'>{gameMessage}</h2>}
			
			<div className='board'>
				{board.map((row, x) => (
					<div key={x} className='row'>
						{row.map((cell, y) => (
							<div
								key={y}
								className={`cell ${cell.revealed ? 'revealed' : ''} 
									${cell.isMine && cell.revealed ? 'mine' : ''} 
									${cell.flagged ? 'flagged' : ''} 
									${cell.count > 0 && cell.revealed ? `count-${cell.count}` : ''}`}
								onClick={() => revealCell(x, y)}
								onContextMenu={e => toggleFlag(e, x, y)}
								data-count={cell.count}>
								{cell.flagged ? 
									'🚩' : 
									(cell.revealed ? 
										(cell.isMine ? 
											'💣' : 
											(cell.count > 0 ? cell.count : '')
										) : 
										''
									)
								}
							</div>
						))}
					</div>
				))}
			</div>
		</div>
	);
};

export default Board;
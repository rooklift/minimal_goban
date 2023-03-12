"use strict";

const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

const square_size = 40;

// Our main state is a 2d array containing a total of 361 entries, each of which is EMPTY / BLACK / WHITE

let board = [];
for (let x = 0; x < 19; x++) {
	board.push([]);
	for (let y = 0; y < 19; y++) {
		board[x].push(EMPTY);
	}
}

let player = BLACK;
let ko = null;

// For specifying coordinates, I use SGF-format strings e.g. "aa" is the 0,0 point (i.e. top left point).

function in_bounds(s) {
	if (typeof s !== "string" || s.length !== 2) {
		return false;
	}
	let x = s.charCodeAt(0) - 97;
	let y = s.charCodeAt(1) - 97;
	return x >= 0 && x < 19 && y >= 0 && y < 19;
}

function state_at(s) {
	if (!in_bounds(s)) {
		return EMPTY;
	}
	let x = s.charCodeAt(0) - 97;
	let y = s.charCodeAt(1) - 97;
	return board[x][y];
}

function neighbours(s) {		// Returns a list of points (each in SGF format, e.g. "cc") which neighbour the point given.
	let ret = [];
	if (!in_bounds(s)) {
		return ret;
	}
	let x = s.charCodeAt(0) - 97;
	let y = s.charCodeAt(1) - 97;
	if (x < 19 - 1) ret.push(xy_to_s(x + 1, y));
	if (x >  0    ) ret.push(xy_to_s(x - 1, y));
	if (y < 19 - 1) ret.push(xy_to_s(x, y + 1));
	if (y >  0    ) ret.push(xy_to_s(x, y - 1));
	return ret;
}

function legal_move(s) {		// Returns true if the active player can legally play at the point given. Does NOT consider passes as "legal moves".

	if (!in_bounds(s) || state_at(s) || ko === s) {
		return false;
	}

	let neigh = neighbours(s);

	// Move will be legal as long as it's not suicide...

	for (let neighbour of neigh) {
		if (state_at(neighbour) === EMPTY) {
			return true;					// New stone has a liberty.
		}
	}

	// Note that the above test is done there rather than inside the loop below
	// because it's super-cheap and so worth doing in its entirety first.

	let inactive = (player === BLACK) ? WHITE : BLACK;

	for (let neighbour of neigh) {
		if (state_at(neighbour) === player) {
			let touched = Object.create(null);
			touched[s] = true;
			if (has_liberties_recurse(neighbour, touched)) {
				return true;				// One of the groups we're joining has a liberty other than s.
			}
		} else if (state_at(neighbour) === inactive) {
			let touched = Object.create(null);
			touched[s] = true;
			if (!has_liberties_recurse(neighbour, touched)) {
				return true;				// One of the enemy groups has no liberties other than s.
			}
		}
	}

	return false;
}

function has_liberties(s) {
	if (state_at(s) === EMPTY) {
		return false;						// I guess? It means we got a bad call.
	}
	let touched = Object.create(null);
	return has_liberties_recurse(s, touched);
}

function has_liberties_recurse(s, touched) {
	touched[s] = true;
	let colour = state_at(s);
	for (let neighbour of neighbours(s)) {
		if (touched[neighbour]) {
			continue;
		}
		let neighbour_colour = state_at(neighbour);
		if (neighbour_colour === EMPTY) {
			return true;
		}
		if (neighbour_colour === colour) {
			if (has_liberties_recurse(neighbour, touched)) {
				return true;
			}
		}
	}
	return false;
}

function play(s) {				// Play the move (or pass) given... contains no legality checks... (do those first!)
	let colour = player;
	ko = null;
	player = (player === BLACK) ? WHITE : BLACK;		// i.e. set the global player var to the next player.
	if (!in_bounds(s)) {								// Treat as a pass.
		return;
	}
	let x = s.charCodeAt(0) - 97;
	let y = s.charCodeAt(1) - 97;
	board[x][y] = colour;
	let caps = 0;
	for (let neighbour of neighbours(s)) {
		let neighbour_colour = state_at(neighbour);
		if (neighbour_colour !== EMPTY && neighbour_colour !== colour) {		// i.e. if it's an enemy stone.
			if (!has_liberties(neighbour)) {
				caps += destroy_group(neighbour);
			}
		}
	}
	if (!has_liberties(s)) {							// Move was suicide.
		destroy_group(s);
	}
	if (caps === 1) {									// Move captured 1 stone...
		if (one_liberty_singleton(s)) {					// ...and created ko.
			ko = empty_neighbour(s);
		}
	}
}

function destroy_group(s) {		// Destroys the group and returns the number of stones removed.
	let group = group_at(s);
	let colour = state_at(s);
	for (let s of group) {
		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;
		board[x][y] = EMPTY;
	}
	return group.length;
}

function group_at(s) {
	if (state_at(s) === EMPTY) {
		return [];
	}
	let touched = Object.create(null);
	group_at_recurse(s, touched);
	return Object.keys(touched);
}

function group_at_recurse(s, touched) {
	touched[s] = true;
	let colour = state_at(s);
	for (let neighbour of neighbours(s)) {
		if (touched[neighbour]) {
			continue;
		}
		if (state_at(neighbour) === colour) {
			group_at_recurse(neighbour, touched);
		}
	}
}

function empty_neighbour(s) {		// Returns an arbitrary empty neighbour of a point. Useful for finding ko square.
	for (let neighbour of neighbours(s)) {
		if (state_at(neighbour) === EMPTY) {
			return neighbour;
		}
	}
	return null;
}

function one_liberty_singleton(s) {	// True iff the point has a stone which is not part of a group and has exactly 1 liberty.
	let colour = state_at(s);
	if (colour === EMPTY) {
		return false;
	}
	let liberties = 0;
	for (let neighbour of neighbours(s)) {
		let neighbour_colour = state_at(neighbour);
		if (neighbour_colour === colour) {
			return false;
		}
		if (!neighbour_colour) {
			liberties++;
		}
	}
	return liberties === 1;
}

function xy_to_canvas_xy(x, y) {
	let gx = (x * square_size) + (square_size / 2);
	let gy = (y * square_size) + (square_size / 2);
	return [gx, gy];
}

function canvas_xy_to_xy(gx, gy) {
	let x = Math.floor(gx / square_size);
	let y = Math.floor(gy / square_size);
	if (x < 0) x = 0;
	if (x >= 19) x = 19 - 1;
	if (y < 0) y = 0;
	if (y >= 19) y = 19 - 1;
	return [x, y];
}

function xy_to_s(x, y) {
	return String.fromCharCode(x + 97) + String.fromCharCode(y + 97);
}

function draw() {

	let canvas_width = square_size * 19;
	let canvas_height = square_size * 19;

	let canvas = document.getElementById("boardcanvas");
	canvas.width = canvas_width;
	canvas.height = canvas_height;
	let ctx = canvas.getContext("2d");

	for (let x = 0; x < 19; x++) {
		let [x1, y1] = xy_to_canvas_xy(x, 0);
		let [x2, y2] = xy_to_canvas_xy(x, 19 - 1);
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	}

	for (let y = 0; y < 19; y++) {
		let [x1, y1] = xy_to_canvas_xy(0, y);
		let [x2, y2] = xy_to_canvas_xy(19 - 1, y);
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	}

	for (let x = 0; x < 19; x++) {
		for (let y = 0; y < 19; y++) {
			if (board[x][y] !== EMPTY) {
				let [gx, gy] = xy_to_canvas_xy(x, y);
				ctx.fillStyle = "#000000ff";
				ctx.beginPath();
				ctx.arc(gx, gy, square_size / 2, 0, 2 * Math.PI);
				ctx.fill();
				if (board[x][y] === WHITE) {
					ctx.fillStyle = "#ffffffff";
					ctx.beginPath();
					ctx.arc(gx, gy, square_size / 2 - 2, 0, 2 * Math.PI);
					ctx.fill();
				}
			}
		}
	}
}

document.getElementById("boardcanvas").addEventListener("mousedown", (event) => {
	let [x, y] = canvas_xy_to_xy(event.offsetX, event.offsetY);
	let s = xy_to_s(x, y);
	if (legal_move(s)) {
		play(s);
		draw();
	}
});

draw();
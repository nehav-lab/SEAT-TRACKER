// ===== server.js =====
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, 'data.json');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Login credentials
const USERS = {
  "student": "1234",
  "admin": "5678",
  "guest": "abcd",
  "library": "9999"
};

// ===== Utility functions =====
function readSeats() {
  if (!fs.existsSync(DATA_PATH)) return {};
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function writeSeats(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// Initialize data.json if missing
if (!fs.existsSync(DATA_PATH)) {
  writeSeats({
    seat1: { status: 'vacant', user: null, break_until: null },
    seat2: { status: 'vacant', user: null, break_until: null }
  });
}

// ===== LOGIN =====
app.post('/login', (req, res) => {
  const { seatId, username, password } = req.body;
  const seats = readSeats();

  if (!USERS[username] || USERS[username] !== password) {
    return res.json({ success: false, message: 'Invalid credentials' });
  }

  // Prevent same user logging into both seats
  const alreadyLoggedIn = Object.values(seats).find(s => s.user === username);
  if (alreadyLoggedIn) {
    return res.json({ success: false, message: 'User already logged in on another seat' });
  }

  // 🟩 New condition: Only allow login if seat is occupied (sensor triggered)
  if (seats[seatId].status === 'vacant') {
    return res.json({ success: false, message: 'Seat is vacant — please sit first.' });
  }

  // 🟧 If seat is occupied but not logged in (orange), allow login
  if (seats[seatId].status === 'occupied' && !seats[seatId].user) {
    seats[seatId].user = username;
    writeSeats(seats);
    return res.json({ success: true, message: 'Login successful' });
  }

  // 🟥 If seat is already occupied AND someone is logged in
  if (seats[seatId].status === 'occupied' && seats[seatId].user) {
    return res.json({ success: false, message: 'Seat already occupied by another user.' });
  }

  return res.json({ success: false, message: 'Unable to login. Try again.' });
});

// ===== LOGOUT =====
app.post('/logout', (req, res) => {
  const { seatId } = req.body;
  const seats = readSeats();

  if (!seats[seatId]) {
    return res.json({ success: false, message: 'Invalid seat ID' });
  }

  // 🟧 Only logout user; ESP will handle seat vacancy automatically
  seats[seatId].user = null;
  writeSeats(seats);

  console.log(`✅ ${seatId} has been logged out.`);
  res.json({ success: true, message: `${seatId} logged out` });
});

// ===== BREAK =====
app.post('/break', (req, res) => {
  const { seatId, minutes } = req.body;
  const seats = readSeats();

  if (!seats[seatId]) {
    return res.status(400).json({ success: false, message: 'Invalid seat ID' });
  }

  const now = Date.now();
  const breakDuration = Number(minutes) * 60 * 1000;

  seats[seatId].status = 'break';
  seats[seatId].break_until = now + breakDuration;
  writeSeats(seats);

  // Auto end break
  setTimeout(() => {
    const current = readSeats();
    const seat = current[seatId];
    if (seat && seat.status === 'break' && Date.now() >= seat.break_until) {
      seat.status = seat.user ? 'occupied' : 'vacant';
      seat.break_until = null;
      writeSeats(current);
    }
  }, breakDuration + 1000);

  return res.json({ success: true, message: `Break started for ${minutes} minutes.` });
});

// ===== UPDATE SEAT (FROM ESP) =====
app.post('/update-seat', (req, res) => {
  const { seatId, status } = req.body;
  const seats = readSeats();

  if (!seats[seatId]) {
    return res.status(400).json({ success: false, message: 'Invalid seat ID' });
  }

  const existingUser = seats[seatId].user;
  const existingBreak = seats[seatId].break_until;

  // 🟧 Update logic — if seat becomes vacant, auto logout
  if (status === 'vacant') {
    seats[seatId] = { status: 'vacant', user: null, break_until: null };
  } else {
    seats[seatId].status = status;
    seats[seatId].user = existingUser;
    seats[seatId].break_until = existingBreak;
  }

  writeSeats(seats);
  res.json({ success: true, message: `Seat ${seatId} updated to ${status}` });
});

// ===== STATUS =====
app.get('/status', (req, res) => {
  const seats = readSeats();
  res.json(seats);
});

// ===== RESET (DEBUG) =====
app.post('/reset', (req, res) => {
  writeSeats({
    seat1: { status: 'vacant', user: null, break_until: null },
    seat2: { status: 'vacant', user: null, break_until: null }
  });
  console.log("🔄 All seats reset to vacant.");
  res.json({ success: true, message: "All seats reset." });
});

// ===== START SERVER =====
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));




















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

  // Check if seat is free
  if (seats[seatId].status !== 'vacant') {
    return res.json({ success: false, message: 'Seat already occupied' });
  }

  // Login success
  seats[seatId] = { status: 'occupied', user: username, break_until: null };
  writeSeats(seats);
  return res.json({ success: true, message: 'Login successful' });
});

// ===== LOGOUT =====
app.post('/logout', (req, res) => {
  const { seatId } = req.body;
  const seats = readSeats();
  seats[seatId] = { status: 'vacant', user: null, break_until: null };
  writeSeats(seats);
  res.json({ success: true });
});

// ===== BREAK (from ESP or Web) =====
app.post('/break', (req, res) => {
  const { seatId, minutes } = req.body;
  const seats = readSeats();

  if (!seats[seatId]) {
    return res.status(400).json({ success: false, message: 'Invalid seat ID' });
  }

  // Allow ESP trigger even if vacant
  if (seats[seatId].status === 'break') {
    return res.json({ success: false, message: 'Seat already on break.' });
  }
  if (seats[seatId].status === 'vacant') {
    seats[seatId].user = "ESP_Device";
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

// ===== UPDATE SEAT STATUS (ESP sends occupancy) =====
app.post('/update-seat', (req, res) => {
  const { seatId, status } = req.body;
  const seats = readSeats();

  if (!seats[seatId]) {
    return res.status(400).json({ success: false, message: 'Invalid seat ID' });
  }

  // Map colors → statuses
  let mappedStatus;
  if (status === 'green') mappedStatus = 'vacant';
  else if (status === 'orange') mappedStatus = 'occupied';
  else if (status === 'yellow') mappedStatus = 'break';
  else mappedStatus = 'vacant';

  seats[seatId].status = mappedStatus;

  // Handle user label for ESP devices
  if (mappedStatus === 'occupied' && !seats[seatId].user)
    seats[seatId].user = "ESP_Device";
  if (mappedStatus === 'vacant')
    seats[seatId].user = null;

  writeSeats(seats);
  res.json({ success: true, message: `Seat ${seatId} updated to ${mappedStatus}` });
});

// ===== FETCH STATUS =====
app.get('/status', (req, res) => {
  const seats = readSeats();
  res.json(seats);
});

// ===== SERVER START =====
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));












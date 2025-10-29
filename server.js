const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// User credentials
const USERS = {
  student: "1234",
  admin: "5678",
  guest: "abcd",
  library: "9999"
};

// Helper functions
function readSeats() {
  if (!fs.existsSync(DATA_PATH)) return {};
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}
function writeSeats(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// Initialize if missing
if (!fs.existsSync(DATA_PATH)) {
  writeSeats({
    seat1: { status: 'vacant', user: null, break_until: null },
    seat2: { status: 'vacant', user: null, break_until: null }
  });
}

// LOGIN
app.post('/login', (req, res) => {
  const { seatId, username, password } = req.body;
  const seats = readSeats();

  if (!USERS[username] || USERS[username] !== password) {
    return res.json({ success: false, message: 'Invalid credentials' });
  }

  const alreadyLoggedIn = Object.values(seats).find(s => s.user === username);
  if (alreadyLoggedIn) {
    return res.json({ success: false, message: 'User already logged in on another seat' });
  }

  if (seats[seatId].status !== 'vacant') {
    return res.json({ success: false, message: 'Seat already occupied' });
  }

  seats[seatId] = { status: 'occupied', user: username, break_until: null };
  writeSeats(seats);
  return res.json({ success: true, message: 'Login successful' });
});

// LOGOUT
app.post('/logout', (req, res) => {
  const { seatId } = req.body;
  const seats = readSeats();
  if (!seats[seatId]) return res.json({ success: false, message: 'Invalid seat ID' });

  seats[seatId] = { status: 'vacant', user: null, break_until: null };
  writeSeats(seats);
  res.json({ success: true, message: `${seatId} logged out` });
});

// BREAK (ESP or user)
app.post('/break', (req, res) => {
  const { seatId, minutes } = req.body;
  const seats = readSeats();
  if (!seats[seatId]) return res.status(400).json({ success: false, message: 'Invalid seat ID' });

  const now = Date.now();
  const duration = Number(minutes) * 60 * 1000;
  seats[seatId].status = 'break';
  seats[seatId].break_until = now + duration;
  writeSeats(seats);

  setTimeout(() => {
    const current = readSeats();
    const seat = current[seatId];
    if (seat && seat.status === 'break' && Date.now() >= seat.break_until) {
      seat.status = seat.user ? 'occupied' : 'vacant';
      seat.break_until = null;
      writeSeats(current);
    }
  }, duration + 1000);

  return res.json({ success: true, message: `Break started for ${minutes} minutes.` });
});

// ESP STATUS UPDATE
app.post('/update-seat', (req, res) => {
  const { seatId, status } = req.body;
  const seats = readSeats();
  if (!seats[seatId]) return res.status(400).json({ success: false, message: 'Invalid seat ID' });

  if (status === 'green') {
    seats[seatId].status = 'vacant';
    seats[seatId].user = null;
  } else if (status === 'orange') {
    seats[seatId].status = 'occupied';
    seats[seatId].user = "Guest";
  } else if (status === 'yellow') {
    seats[seatId].status = 'break';
  }

  writeSeats(seats);
  res.json({ success: true });
});

// STATUS (for display page)
app.get('/status', (req, res) => {
  res.json(readSeats());
});

// RESET (debug)
app.post('/reset', (req, res) => {
  writeSeats({
    seat1: { status: 'vacant', user: null, break_until: null },
    seat2: { status: 'vacant', user: null, break_until: null }
  });
  res.json({ success: true, message: 'All seats reset' });
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));


















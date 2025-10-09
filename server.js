// ===== server.js =====
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const USERS = {
  "student": "1234",
  "admin": "5678",
  "guest": "abcd",
  "library": "9999"
};

// ===== Utility =====
function readSeats() {
  if (!fs.existsSync(DATA_PATH)) return {};
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}
function writeSeats(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// Initialize
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

  if (!USERS[username] || USERS[username] !== password)
    return res.json({ success: false, message: 'Invalid credentials' });

  const alreadyLoggedIn = Object.values(seats).find(s => s.user === username);
  if (alreadyLoggedIn)
    return res.json({ success: false, message: 'User already logged in on another seat' });

  if (seats[seatId].status !== 'vacant')
    return res.json({ success: false, message: 'Seat already occupied' });

  seats[seatId] = { status: 'occupied', user: username, break_until: null };
  writeSeats(seats);
  res.json({ success: true, message: 'Login successful' });
});

// ===== LOGOUT =====
app.post('/logout', (req, res) => {
  const { seatId } = req.body;
  const seats = readSeats();

  seats[seatId] = { status: 'vacant', user: null, break_until: null };
  writeSeats(seats);
  console.log(`✅ ${seatId} logged out.`);
  res.json({ success: true });
});

// ===== BREAK =====
app.post('/break', (req, res) => {
  const { seatId, minutes } = req.body;
  const seats = readSeats();

  const now = Date.now();
  const duration = Number(minutes) * 60 * 1000;
  seats[seatId].status = 'break';
  seats[seatId].break_until = now + duration;
  writeSeats(seats);

  setTimeout(() => {
    const current = readSeats();
    const seat = current[seatId];
    if (seat.status === 'break' && Date.now() >= seat.break_until) {
      seat.status = seat.user ? 'occupied' : 'vacant';
      seat.break_until = null;
      writeSeats(current);
    }
  }, duration + 1000);

  res.json({ success: true });
});

// ===== ESP UPDATE (FSR + touch sensors) =====
app.post('/update-seat', (req, res) => {
  const { seatId, status } = req.body;
  const seats = readSeats();

  if (!seats[seatId])
    return res.status(400).json({ success: false, message: 'Invalid seat ID' });

  seats[seatId].status = status; // "green", "yellow", "orange"
  writeSeats(seats);

  console.log(`📡 ${seatId} updated from ESP: ${status}`);
  res.json({ success: true });
});

// ===== STATUS =====
app.get('/status', (req, res) => {
  res.json(readSeats());
});

// ===== RESET =====
app.post('/reset', (req, res) => {
  writeSeats({
    seat1: { status: 'vacant', user: null, break_until: null },
    seat2: { status: 'vacant', user: null, break_until: null }
  });
  console.log("🔄 All seats reset.");
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));













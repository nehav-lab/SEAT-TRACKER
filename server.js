// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');   // ✅ Added session import

const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, 'data.json');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Session setup (added right below app creation)
app.use(session({
  secret: 'super_secret_key_here', // any random string you choose
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 } // 1 hour session expiry
}));

// ✅ Login credentials
const USERS = {
  "student": "1234",
  "admin": "5678",
  "guest": "abcd",
  "library": "9999"
};

// --- Helper functions ---
function readSeats() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function writeSeats(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// --- Initialize data.json if not exists ---
if (!fs.existsSync(DATA_PATH)) {
  const initial = {
    seat1: { status: 'vacant', user: null, break_until: null },
    seat2: { status: 'vacant', user: null, break_until: null }
  };
  writeSeats(initial);
}

// ✅ LOGIN — one seat per user, one user per seat, with session lock
app.post('/login', (req, res) => {
  const { seatId, username, password } = req.body;
  const seats = readSeats();

  if (!seats[seatId]) {
    return res.status(400).json({ success: false, message: 'Invalid seat ID' });
  }

  // 1️⃣ If seat already occupied or on break → block login
  if (seats[seatId].status === 'occupied' || seats[seatId].status === 'break') {
    return res.json({
      success: false,
      message: `Seat already in use by ${seats[seatId].user || 'another user'}.`
    });
  }

  // 2️⃣ Check if user already using another seat
  const alreadyUsingSeat = Object.entries(seats).find(
    ([id, seat]) => seat.user === username && seat.status !== 'vacant'
  );
  if (alreadyUsingSeat) {
    const [id] = alreadyUsingSeat;
    return res.json({
      success: false,
      message: `User ${username} is already logged in at ${id}. Please logout there first.`
    });
  }

  // 3️⃣ Validate credentials
  if (USERS[username] && USERS[username] === password) {
    seats[seatId].status = 'occupied';
    seats[seatId].user = username;
    seats[seatId].break_until = null;
    writeSeats(seats);

    // ✅ Save login session
    req.session.username = username;
    req.session.seatId = seatId;

    return res.json({ success: true, message: 'Login successful', username });
  } else {
    return res.json({ success: false, message: 'Invalid credentials' });
  }
});

// ✅ LOGOUT — free the seat and clear session
app.post('/logout', (req, res) => {
  const { seatId } = req.body;
  const seats = readSeats();

  if (!seats[seatId]) {
    return res.status(400).json({ success: false });
  }

  seats[seatId].status = 'vacant';
  seats[seatId].user = null;
  seats[seatId].break_until = null;
  writeSeats(seats);

  // ✅ Clear session
  req.session.destroy(() => {
    res.json({ success: true, message: 'Seat logged out / freed.' });
  });
});

// ✅ BREAK — temporarily mark seat as on break
app.post('/break', (req, res) => {
  const { seatId, minutes } = req.body;
  const seats = readSeats();

  if (!seats[seatId]) {
    return res.status(400).json({ success: false, message: 'Invalid seat ID' });
  }

  if (seats[seatId].status !== 'occupied') {
    return res.json({ success: false, message: 'Seat must be occupied to start a break.' });
  }

  const now = Date.now();
  const breakDuration = Number(minutes) * 60 * 1000;

  seats[seatId].status = 'break';
  seats[seatId].break_until = now + breakDuration;
  writeSeats(seats);

  // Auto-end break
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

// ✅ STATUS — include current logged-in username for client
app.get('/status', (req, res) => {
  const seats = readSeats();
  res.json({
    seats,
    currentUser: req.session.username || null,
    currentSeat: req.session.seatId || null
  });
});

// ✅ Serve display.html as homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});







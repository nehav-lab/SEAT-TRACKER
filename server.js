// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "data.json");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const USERS = {
  "student": "1234",
  "admin": "5678",
  "guest": "abcd",
  "library": "9999"
};

// --- Helper functions ---
function readSeats() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function writeSeats(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// --- Initialize file if missing ---
if (!fs.existsSync(DATA_PATH)) {
  const initialData = {
    seat1: { status: "vacant", user: null, break_until: null },
    seat2: { status: "vacant", user: null, break_until: null }
  };
  writeSeats(initialData);
}

// ✅ LOGIN route
app.post("/login", (req, res) => {
  const { seatId, username, password } = req.body;
  const seats = readSeats();

  if (!seats[seatId]) return res.status(400).json({ success: false, message: "Invalid seat" });

  if (seats[seatId].status === "occupied" || seats[seatId].status === "break") {
    return res.json({ success: false, message: "Seat is already in use!" });
  }

  if (USERS[username] && USERS[username] === password) {
    seats[seatId].status = "occupied";
    seats[seatId].user = username;
    seats[seatId].break_until = null;
    writeSeats(seats);
    return res.json({ success: true, message: "Login successful!" });
  } else {
    return res.json({ success: false, message: "Invalid credentials" });
  }
});

// ✅ LOGOUT route
app.post("/logout", (req, res) => {
  const { seatId } = req.body;
  const seats = readSeats();

  if (!seats[seatId]) return res.status(400).json({ success: false });

  seats[seatId].status = "vacant";
  seats[seatId].user = null;
  seats[seatId].break_until = null;
  writeSeats(seats);

  res.json({ success: true, message: "Logged out / Seat freed" });
});

// ✅ BREAK route (ESP + user compatible)
app.post("/break", (req, res) => {
  const { seatId, minutes } = req.body;
  const seats = readSeats();

  if (!seats[seatId]) {
    return res.status(400).json({ success: false, message: "Invalid seat ID" });
  }

  // Allow ESP trigger even if vacant
  if (seats[seatId].status === "break") {
    return res.json({ success: false, message: "Seat already on break." });
  }
  if (seats[seatId].status === "vacant") {
    seats[seatId].user = "ESP_Device"; // show who triggered break
  }

  const now = Date.now();
  const breakDuration = Number(minutes) * 60 * 1000;

  seats[seatId].status = "break";
  seats[seatId].break_until = now + breakDuration;
  writeSeats(seats);

  // Auto-end break after set time
  setTimeout(() => {
    const current = readSeats();
    const seat = current[seatId];
    if (seat && seat.status === "break" && Date.now() >= seat.break_until) {
      seat.status = seat.user && seat.user !== "ESP_Device" ? "occupied" : "vacant";
      seat.break_until = null;
      writeSeats(current);
    }
  }, breakDuration + 1000);

  res.json({ success: true, message: `Break started for ${minutes} minutes.` });
});

// ✅ STATUS route
app.get("/status", (req, res) => {
  const seats = readSeats();
  res.json({ seats });
});

// ✅ Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "display.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});








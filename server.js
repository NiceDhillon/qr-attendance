const express = require("express");
const qrcode = require("qrcode");
const path = require("path");
const { google } = require("googleapis");

const app = express();
app.use(express.json());
app.use(express.static("public"));

/* ================= GOOGLE SHEETS SETUP ================= */
const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheets = google.sheets({ version: "v4", auth });
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

/* ================= GLOBAL STATE ================= */
let currentSession = null;
let attendance = [];

/* ================= IST TIME HELPERS ================= */
function formatIST(date) {
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

function formatISTDate(date) {
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata"
  });
}

/* ================= DISTANCE FUNCTION ================= */
function distance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = v => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ================= ROOT → ADMIN ================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

/* ================= GENERATE QR ================= */
app.post("/generate-qr", async (req, res) => {
  const { lat, lon, accuracy } = req.body;

  const generatedAt = new Date();
  const expiresAt = new Date(generatedAt.getTime() + 2 * 60 * 1000);

  currentSession = {
    id: Date.now().toString(),
    generatedAt,
    expiresAt,
    adminLocation: { lat, lon, accuracy },
    usedDevices: new Set(),
    active: true
  };

  attendance = [];

  const qrURL = `${req.protocol}://${req.get("host")}/student.html?session=${currentSession.id}`;
  const qr = await qrcode.toDataURL(qrURL);

  res.json({
    qr,
    generatedAt: `${formatISTDate(generatedAt)} ${formatIST(generatedAt)}`,
    expiresAt: `${formatISTDate(expiresAt)} ${formatIST(expiresAt)}`
  });
});

/* ================= MARK ATTENDANCE ================= */
app.post("/mark-attendance", async (req, res) => {
  const { name, roll, deviceId, sessionId, lat, lon, accuracy } = req.body;

  if (!currentSession || sessionId !== currentSession.id)
    return res.status(400).json({ error: "Invalid session" });

  const now = new Date();

  if (now > currentSession.expiresAt) {
    currentSession.active = false;
    return res.status(403).json({ error: "QR expired" });
  }

  if (currentSession.usedDevices.has(deviceId))
    return res.status(403).json({ error: "Attendance already marked" });

  const d = distance(
    lat,
    lon,
    currentSession.adminLocation.lat,
    currentSession.adminLocation.lon
  );

  const effectiveDistance =
    d - accuracy - currentSession.adminLocation.accuracy;

  if (effectiveDistance > 50)
    return res.status(403).json({ error: "Outside 50m range" });

  currentSession.usedDevices.add(deviceId);

  const record = {
    name,
    roll,
    date: formatISTDate(now),
    time: formatIST(now)
  };

  attendance.push(record);

  /* ===== SAVE TO GOOGLE SHEET ===== */
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "Attendance!A:D",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[record.name, record.roll, record.date, record.time]]
    }
  });

  res.json({ success: true });
});

/* ================= SESSION STATUS ================= */
app.get("/session-status", (req, res) => {
  if (!currentSession) return res.json({ active: false });

  const now = new Date();
  const active = now <= currentSession.expiresAt;
  currentSession.active = active;

  res.json({ active });
});

/* ================= DOWNLOAD CSV ================= */
app.get("/download", (req, res) => {
  if (!currentSession || currentSession.active)
    return res.status(403).send("Session still active");

  let csv = "";
  csv += `QR Generated At,${formatISTDate(currentSession.generatedAt)} ${formatIST(currentSession.generatedAt)}\n`;
  csv += `QR Expired At,${formatISTDate(currentSession.expiresAt)} ${formatIST(currentSession.expiresAt)}\n\n`;
  csv += "Name,Roll No,Date,Time\n";

  attendance.forEach(a => {
    csv += `${a.name},${a.roll},${a.date},${a.time}\n`;
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=attendance.csv");
  res.send(csv);
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));

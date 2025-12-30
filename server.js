const express = require("express");
const qrcode = require("qrcode");
const { google } = require("googleapis");

const app = express();
app.use(express.json());
app.use(express.static("public"));

/* ===== GOOGLE SHEETS CONFIG ===== */
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: SCOPES,
});

const sheets = google.sheets({ version: "v4", auth });

/* ===== TIMEZONE CONFIG (INDIA) ===== */
const IST_TIME = {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
};

const IST_DATE = {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
};

/* ===== SESSION DATA ===== */
let currentSession = null;
let attendance = [];

/* ===== DISTANCE FUNCTION ===== */
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

/* ===== ADMIN: GENERATE QR ===== */
app.post("/generate-qr", (req, res) => {
  const { lat, lon, accuracy } = req.body;

  const generatedAt = new Date();
  const expiresAt = new Date(generatedAt.getTime() + 2 * 60 * 1000);

  currentSession = {
    id: Date.now().toString(),
    generatedAt,
    expiresAt,
    adminLocation: { lat, lon, accuracy },
    usedDevices: new Set(),
  };

  attendance = [];

  const qrURL = `${req.protocol}://${req.get("host")}/student.html?session=${currentSession.id}`;

  qrcode.toDataURL(qrURL).then(qr => {
    res.json({
      qr,
      generatedAt: generatedAt.toLocaleString("en-IN", IST_DATE),
      expiresAt: expiresAt.toLocaleString("en-IN", IST_DATE),
    });
  });
});

/* ===== STUDENT: MARK ATTENDANCE ===== */
app.post("/mark-attendance", async (req, res) => {
  const { name, roll, deviceId, sessionId, lat, lon, accuracy } = req.body;

  if (!currentSession || sessionId !== currentSession.id)
    return res.status(400).json({ error: "Invalid session" });

  if (new Date() > currentSession.expiresAt)
    return res.status(403).json({ error: "QR expired" });

  if (currentSession.usedDevices.has(deviceId))
    return res.status(403).json({ error: "Attendance already marked from this device" });

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

  const now = new Date();
  const record = {
    name,
    roll,
    time: now.toLocaleTimeString("en-IN", IST_TIME),
  };

  attendance.push(record);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Attendance!A:C",
    valueInputOption: "RAW",
    resource: { values: [[record.name, record.roll, record.time]] },
  });

  res.json({ success: true });
});

/* ===== ADMIN: DOWNLOAD CSV ===== */
app.get("/download", (req, res) => {
  if (!currentSession) return res.status(400).send("No session");

  let csv = "";
  csv += `QR Generated At,${currentSession.generatedAt.toLocaleString("en-IN", IST_DATE)}\n`;
  csv += `QR Expires At,${currentSession.expiresAt.toLocaleString("en-IN", IST_DATE)}\n`;
  csv += `Attendance Window,2 Minutes\n\n`;
  csv += "Name,Roll No,Time\n";

  attendance.forEach(a => {
    csv += `${a.name},${a.roll},${a.time}\n`;
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=attendance.csv");
  res.send(csv);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));

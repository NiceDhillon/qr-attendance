const express = require("express");
const qrcode = require("qrcode");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("public"));

let currentSession = null;
let attendance = [];

/* ---------- IST (Delhi) Time Formatter ---------- */
function formatIST(date) {
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

/* ---------- Distance (Haversine) ---------- */
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

/* ---------- Home → Admin ---------- */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

/* ---------- Generate QR (Admin) ---------- */
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
    generatedAt: formatIST(generatedAt),
    expiresAt: formatIST(expiresAt),
    duration: 120
  });
});

/* ---------- Mark Attendance (Student) ---------- */
app.post("/mark-attendance", (req, res) => {
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

  attendance.push({
    name,
    roll,
    time: formatIST(now)
  });

  res.json({ success: true });
});

/* ---------- Session Status (Admin Polling) ---------- */
app.get("/session-status", (req, res) => {
  if (!currentSession) return res.json({ active: false });

  const now = new Date();
  const active = now <= currentSession.expiresAt;
  currentSession.active = active;

  res.json({
    active,
    expiresAt: formatIST(currentSession.expiresAt)
  });
});

/* ---------- Download CSV (ONLY after expiry) ---------- */
app.get("/download", (req, res) => {
  if (!currentSession || currentSession.active)
    return res.status(403).send("Session still active");

  let csv = "";
  csv += `QR Generated At,${formatIST(currentSession.generatedAt)}\n`;
  csv += `QR Expired At,${formatIST(currentSession.expiresAt)}\n`;
  csv += `Attendance Window,2 Minutes\n\n`;
  csv += "Name,Roll No,Time\n";

  attendance.forEach(a => {
    csv += `${a.name},${a.roll},${a.time}\n`;
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=attendance.csv");
  res.send(csv);
});

/* ---------- Start Server ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));

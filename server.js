const express = require("express");
const qrcode = require("qrcode");

const app = express();
app.use(express.json());
app.use(express.static("public"));

let currentSession = null;
let attendance = [];

// Haversine distance
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

// Generate QR (Admin)
app.post("/generate-qr", (req, res) => {
  const { lat, lon, accuracy } = req.body;

  const generatedAt = new Date();
  const expiresAt = new Date(generatedAt.getTime() + 2 * 60 * 1000);

  currentSession = {
    id: Date.now().toString(),
    generatedAt,
    expiresAt,
    adminLocation: { lat, lon, accuracy },
    usedDevices: new Set()
  };

  attendance = [];

  const qrURL = `${req.protocol}://${req.get("host")}/student.html?session=${currentSession.id}`;

  qrcode.toDataURL(qrURL).then(qr => {
    res.json({
      qr,
      generatedAt: generatedAt.toLocaleString(),
      expiresAt: expiresAt.toLocaleString()
    });
  });
});

// Mark Attendance (Student)
app.post("/mark-attendance", (req, res) => {
  const { name, roll, deviceId, sessionId, lat, lon, accuracy } = req.body;

  if (!currentSession || sessionId !== currentSession.id) {
    return res.status(400).json({ error: "Invalid session" });
  }

  const now = new Date();

  if (now > currentSession.expiresAt) {
    return res.status(403).json({ error: "QR expired" });
  }

  if (currentSession.usedDevices.has(deviceId)) {
    return res.status(403).json({ error: "Attendance already marked from this device" });
  }

  const d = distance(
    lat,
    lon,
    currentSession.adminLocation.lat,
    currentSession.adminLocation.lon
  );

  const effectiveDistance =
    d - accuracy - currentSession.adminLocation.accuracy;

  if (effectiveDistance > 50) {
    return res.status(403).json({
      error: `Outside allowed range (${Math.round(effectiveDistance)} m)`
    });
  }

  currentSession.usedDevices.add(deviceId);

  attendance.push({
    name,
    roll,
    time: now.toLocaleTimeString()
  });

  res.json({ success: true });
});

// Download CSV (Admin)
app.get("/download", (req, res) => {
  if (!currentSession) {
    return res.status(400).send("No session available");
  }

  let csv = "";
  csv += `QR Generated At,${currentSession.generatedAt.toLocaleString()}\n`;
  csv += `QR Expires At,${currentSession.expiresAt.toLocaleString()}\n`;
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
app.listen(PORT, () => console.log("Server running"));

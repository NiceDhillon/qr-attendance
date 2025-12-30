# QR-Based Attendance System 📱✅

A secure, session-based QR Code Attendance System designed to ensure **accurate, fair, and tamper-resistant attendance marking** using **time-bound, location-bound, and device-bound validation**.

This project is implemented as a **permanent web application**, suitable for real classroom use and academic evaluation.

---

## 🚀 Key Features

- Admin generates a **QR code valid for 2 minutes**
- Students scan QR using their mobile phones
- Attendance is accepted only if **ALL conditions are satisfied**:
  - ⏱ Within QR validity time (2 minutes)
  - 📍 Within 50 meters of admin location
  - 📱 Only once per device
- Location accuracy handled using **Geolocation API accuracy radius**
- Attendance records include:
  - Student Name
  - Roll Number
  - Time of attendance
- Attendance grouped **per QR session**
- Admin can download attendance data as CSV
- Permanent deployment (no localhost / no ngrok)

---

## 🛠️ Technologies Used

- **Frontend:** HTML, CSS, JavaScript  
- **Backend:** Node.js, Express.js  
- **QR Code Generation:** `qrcode` npm package  
- **Location API:** Geolocation API (MDN Web Docs)  
- **Distance Calculation:** Haversine Formula  
- **Deployment Platform:** Render  
- **Version Control:** Git & GitHub  

---

## 📂 Project Structure

attendance/
├── server.js
├── package.json
├── package-lock.json
├── .gitignore
├── public/
│ ├── admin.html
│ ├── student.html
│ └── style.css
└── README.md


---

## ⚙️ How the System Works

### 1️⃣ QR Generation (Admin)
- Admin opens the admin page
- Admin location is captured using the **Geolocation API**
- A QR code is generated with:
  - Session ID
  - Generation timestamp
  - Expiry timestamp (after 2 minutes)

### 2️⃣ Student Attendance
- Student scans QR using mobile phone
- Student enters:
  - Name
  - Roll Number
- Browser requests live location access
- Device is identified using a **unique device ID** stored locally

### 3️⃣ Validation Logic
Attendance is accepted only if **ALL conditions are satisfied**:

- ⏱ Current time ≤ QR expiry time  
- 📱 Device has not submitted attendance before  
- 📍 Student is within 50 meters of admin  

---

## 📍 Location Accuracy Handling (MDN-Compliant)

GPS readings include an **accuracy radius**, which represents the possible error in location data.

To avoid false rejection due to GPS drift, the system calculates:
    Effective Distance = Actual Distance − Student Accuracy − Admin Accuracy


Attendance is allowed only if:
    Effective Distance ≤ 50 meters


This approach follows best practices recommended by **MDN Web Docs** for the Geolocation API and ensures fair validation in real-world conditions.

---

## 📄 CSV Attendance Format

Attendance is exported **per QR session**.

Example CSV output:
    QR Generated At,30 Dec 2025 11:00 AM
    QR Expires At,30 Dec 2025 11:02 AM
    Attendance Window,2 Minutes
    Name,Roll No,Time
    Nice Dhillon,23CS101,11:00:32
    Aman Kumar,23CS102,11:01:10


This clearly indicates:
- Session timing
- Valid attendance window
- Students who successfully marked attendance

---

## 🔐 Security Measures

- QR code automatically expires after 2 minutes
- Each device can mark attendance only once per session
- Backend validates time, location, and device ID
- Location data is **used only for validation**, not stored
- Sensitive files (e.g., credentials) are excluded from version control

---

## 🌐 Deployment

The application is deployed as a **public web service** using Render.

Advantages:
- Accessible from any device
- No need to run a local server
- No tunneling tools like ngrok
- Suitable for real-world classroom usage

---

## 🎓 Academic Relevance

This project demonstrates:
- Client–server architecture
- Secure session-based design
- Real-time geolocation validation
- Practical handling of GPS accuracy limitations
- Industry-standard deployment workflow

---

## 👨‍💻 Author

**Nice Dhillon**  
QR-Based Attendance System  
Academic Project

---

## 📌 License

This project is intended for academic use only.

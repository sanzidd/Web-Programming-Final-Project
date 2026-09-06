<div align="center">
  <img src="RUET_LOGO.png" alt="RUET Logo" width="120" />
  <h1>RUET Teacher Feedback System</h1>
 
  <p>An anonymous, web-based platform for students of Rajshahi University of Engineering & Technology to rate and review their teachers confidentially — enabling data-driven academic improvement.</p>
  <p>
    <a href="https://teacher-feedback-system.netlify.app/" target="_blank">
      <img src="https://img.shields.io/badge/Live%20Demo-Visit%20Site-0A1628?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" />
    </a>
    &nbsp;
    <img src="https://img.shields.io/badge/Status-Active-22c55e?style=for-the-badge" alt="Status" />
    &nbsp;
    <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
  </p>
  <p>
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black" />
    <img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black" />
    <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white" />
    <img src="https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white" />
    <img src="https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white" />
    <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" />
    <img src="https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white" />
  </p>
</div>
---
 
## 📌 Overview
 
The **RUET Teacher Feedback System** is a full-stack web application developed as a group final project for the Web Programming course at RUET. It provides a secure and anonymous channel for students to submit structured feedback on their teachers — covering teaching quality, communication, fairness, and more — while giving faculty and administrators meaningful insights through aggregated analytics.
 
> 🔒 All feedback is submitted anonymously. No student identity is linked to any review.
 
---
 
## ✨ Features
 
- 🗳️ **Anonymous Feedback Submission** — Students submit ratings and comments without identity exposure
- ⭐ **Multi-Criteria Rating** — Evaluate teachers across multiple dimensions (clarity, fairness, engagement, etc.)
- 📊 **Feedback Analytics** — Aggregated scores and trends presented visually per teacher/department
- 🔐 **Role-Based Access** — Separate views and permissions for students, teachers, and admins
- 📁 **Feedback Archive** — Historical records browsable by department or course
- 📱 **Responsive Design** — Fully functional across desktop and mobile devices
---
 
## 🗂️ Project Structure
 
```
Web-Programming-Final-Project/
│
├── client/               # Frontend — React application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route-level page components
│   │   └── assets/       # Images, icons, fonts
│   └── package.json
│
├── server/               # Backend — Node.js / Express REST API
│   ├── routes/           # API route definitions
│   ├── controllers/      # Business logic handlers
│   ├── models/           # Database models / schemas
│   └── package.json
│
├── Feedback/             # Sample feedback data / seed files
├── test_db.js            # Database connection test script
├── RUET_LOGO.png         # University logo asset
└── README.md
```
 
---
 
## 🛠️ Tech Stack
 
| Layer | Technology |
|---|---|
| **Frontend** | React.js, CSS3, HTML5 |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB (via Mongoose) |
| **Utility Scripts** | Python |
| **Deployment** | Vercel (frontend), Render / Railway (backend) |
 
---
 
## 🚀 Getting Started
 
### Prerequisites
 
- [Node.js](https://nodejs.org/) v18+
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A running MongoDB instance (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
---
 
### 1. Clone the Repository
 
```bash
git clone https://github.com/sanzidd/Web-Programming-Final-Project.git
cd Web-Programming-Final-Project
```
 
---
 
### 2. Configure Environment Variables
 
**Server** — create `server/.env`:
 
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
```
 
**Client** — create `client/.env`:
 
```env
REACT_APP_API_URL=http://localhost:5000
```
 
---
 
### 3. Install Dependencies & Run
 
**Backend:**
 
```bash
cd server
npm install
npm start
```
 
**Frontend** (in a new terminal):
 
```bash
cd client
npm install
npm start
```
 
The app will be available at `http://localhost:3000`.
 
---
 
### 4. Test Database Connection
 
```bash
node test_db.js
```
 
---
 
## 🌐 Live Demo
 
| Environment | URL |
|---|---|
| **Production** | [teacher-feedback-system.netlify.app](https://teacher-feedback-system.netlify.app/) |
 
---
 
## 👥 Team
 
This project was developed as a group final project for the **Web Programming** course at the Department of Electronics & Telecommunication Engineering (ETE), RUET.
 
| Member | Role |
|---|---|
| [Sanzid](https://github.com/sanzidd) | Full-Stack Developer |
 
> Update team member names and roles as appropriate.
 
---
 
## 📄 License
 
This project is licensed under the [MIT License](LICENSE). Feel free to use, modify, and distribute it with attribution.
 
---
 
<div align="center">
  <sub>Built with ❤️ at <strong>Rajshahi University of Engineering & Technology (RUET)</strong></sub>
</div>
 

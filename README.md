# 🔒 Secure Share

A secure file sharing web application that allows users to upload, encrypt, store, and securely share files. The application uses JWT authentication, AES-256 encryption, and expiring share links to protect user data.

**Live Demo:** https://secfileshare.duckdns.org

---

## 🚀 Features

- User Registration & Login
- JWT Authentication
- Secure File Upload
- AES-256 File Encryption
- Download Encrypted Files
- Create Share Links
- Password Protected Share Links
- Expiring Share Links
- Delete Files
- Responsive User Interface
- HTTPS Enabled

---

## 🛠️ Tech Stack

### Backend
- Node.js
- Express.js

### Authentication
- JWT
- bcrypt

### Security
- AES-256-GCM Encryption

### Storage
- Local File Storage
- JSON Database

### Deployment
- AWS EC2
- Nginx
- PM2
- DuckDNS
- Let's Encrypt SSL

---

## 📂 Project Structure

```
secure-share/
│
├── server.js
├── auth.js
├── crypto-utils.js
├── db.js
├── package.json
├── .env.example
│
├── public/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── share.html
│   └── style.css
│
├── uploads/
└── data/
```

---

## ⚙️ Installation

### Clone Repository

```bash
git clone https://github.com/Mansh-0224/simple-secure-share.git

cd simple-secure-share
```

### Install Dependencies

```bash
npm install
```

### Create Environment File

Copy:

```bash
cp .env.example .env
```

Generate secure keys:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run the command twice.

Update `.env`:

```env
PORT=4000

JWT_SECRET=YOUR_SECRET

FILE_ENCRYPTION_KEY=YOUR_KEY

MAX_FILE_SIZE_MB=50
```

---

## ▶️ Run the Project

```bash
npm start
```

Open

```
http://localhost:4000
```

---

## ☁️ Deployment

The application is deployed on:

- AWS EC2 (Ubuntu)
- PM2
- Nginx Reverse Proxy
- DuckDNS
- Let's Encrypt SSL

Live URL

```
https://secfileshare.duckdns.org
```

---

## 🔐 Security Features

- AES-256-GCM File Encryption
- JWT Authentication
- Password Hashing using bcrypt
- Password Protected Share Links
- HTTPS Encryption
- Expiring Share Links

---

## 📸 Application Workflow

1. Register an account
2. Login securely
3. Upload a file
4. File is encrypted before storage
5. Generate a secure share link
6. Share the link with others
7. Recipient downloads the file securely

---

## 📌 Future Improvements

- Email Verification
- Two-Factor Authentication
- Cloud Storage Support
- User Dashboard Analytics
- Database Migration (MongoDB/PostgreSQL)
- File Preview
- Folder Management
- Admin Dashboard

---

## 👩‍💻 Author

**Manvi Sharma**

Computer Science Engineering Student

Cybersecurity | Cloud Computing | Full Stack Development

GitHub: https://github.com/YOUR_USERNAME
LinkedIn: [YOUR_LINKEDIN](https://www.linkedin.com/in/manvi-sharma-986b6927a/)

---

## ⭐ If you like this project

Give it a ⭐ on GitHub!

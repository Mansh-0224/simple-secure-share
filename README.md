# 🔒 Simple Secure Share

A minimal, single-process secure file sharing app. Upload files (encrypted at rest with AES-256-GCM), download them, and create expiring/password-protected share links — all with **zero external services**:

- No Docker
- No database server to install (uses a JSON file instead of PostgreSQL)
- No frontend build step (plain HTML/CSS/JS, no React)

This trades some production-scale features (multi-server support, huge file counts) for radical simplicity. It's meant for personal use, small teams, or learning — not for hosting thousands of users' files.

## What it does

- Register / log in (JWT-based sessions, bcrypt-hashed passwords)
- Upload a file → it's encrypted with AES-256-GCM before being written to disk
- List, download, delete your own files
- Create a share link for any file: optional password, expiry time, works without an account for the recipient
- Revoke a share link at any time

## Project structure

```
simple-secure-share/
├── server.js          # Express app, all routes
├── db.js              # JSON-file "database" (data/db.json)
├── crypto-utils.js     # AES-256-GCM encryption helpers
├── auth.js             # JWT middleware
├── public/              # Plain HTML/CSS/JS frontend, no build step
│   ├── index.html       # Dashboard (upload, list, share)
│   ├── login.html
│   ├── register.html
│   ├── share.html        # Public share-link page
│   └── style.css
├── uploads/              # Encrypted file blobs live here
├── data/                  # data/db.json lives here (created on first run)
├── package.json
└── .env.example
```

## Run it locally

### Windows (cmd)
```cmd
cd simple-secure-share
copy .env.example .env
```
Generate two secrets and paste them into `.env` (open with `notepad .env`):
```cmd
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Run that command twice — once for `JWT_SECRET`, once for `FILE_ENCRYPTION_KEY`. Both need to be the 64-character hex output.

Then:
```cmd
npm install
npm start
```
Open **http://localhost:4000** in your browser.

### Mac/Linux
```bash
cd simple-secure-share
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # run twice, fill in .env
npm install
npm start
```

## Uploading to GitHub

```bash
git init
git add .
git status   # confirm .env is NOT listed (it's gitignored)
git commit -m "Initial commit: Simple Secure Share"
git remote add origin https://github.com/YOUR_USERNAME/simple-secure-share.git
git branch -M main
git push -u origin main
```

Only `.env.example` (placeholders) gets pushed — your real `.env` with actual secrets stays local, same as before.

## Deploying to AWS

This app is a single Node process, so the simplest AWS option is a small **EC2 instance** running Node directly (no Docker, no Elastic Beanstalk needed, though that's a valid alternative if you prefer a managed platform).

### Option A: EC2 (recommended for this simple app)

**1. Launch an instance**
- AWS Console → EC2 → Launch Instance
- Choose **Amazon Linux 2023** (or Ubuntu 22.04)
- Instance type: `t2.micro` (free-tier eligible)
- Create/select a key pair (`.pem` file) — you'll need it to connect
- Security group: allow inbound **SSH (22)** from your IP, and **HTTP custom TCP port 4000** (or 80, see step 5) from `0.0.0.0/0`

**2. Connect to it**

On Windows, use PuTTY or, if you have OpenSSH available (Windows 10/11 usually does):
```cmd
ssh -i "your-key.pem" ec2-user@YOUR_EC2_PUBLIC_IP
```

**3. Install Node.js on the instance**
```bash
sudo dnf install -y nodejs npm git    # Amazon Linux 2023
# or: sudo apt update && sudo apt install -y nodejs npm git   (Ubuntu)
node -v   # confirm it installed
```

**4. Clone your repo and configure it**
```bash
git clone https://github.com/YOUR_USERNAME/simple-secure-share.git
cd simple-secure-share
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # run twice
nano .env    # paste in JWT_SECRET and FILE_ENCRYPTION_KEY, save with Ctrl+O, exit Ctrl+X
npm install
```

**5. Keep it running permanently with pm2**

If you just run `npm start`, the app stops the moment you close your SSH session. `pm2` keeps it running in the background and restarts it if it crashes or the instance reboots:
```bash
sudo npm install -g pm2
pm2 start server.js --name simple-secure-share
pm2 save
pm2 startup    # follow the printed command to enable auto-start on reboot
```

**6. Access your site**

Visit `http://YOUR_EC2_PUBLIC_IP:4000` in a browser. Find your public IP under EC2 → Instances → your instance → "Public IPv4 address."

**7. (Optional) Serve on port 80 instead of 4000**

So visitors don't need `:4000` in the URL:
```bash
sudo dnf install -y nginx    # or apt install nginx
```
Edit `/etc/nginx/nginx.conf` (or add a file under `/etc/nginx/conf.d/`) with:
```nginx
server {
    listen 80;
    location / {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
Then:
```bash
sudo systemctl enable nginx
sudo systemctl start nginx
```
Now the site is reachable on plain `http://YOUR_EC2_PUBLIC_IP` (port 80), with nginx forwarding to your Node app on 4000 behind the scenes. Update your security group to allow inbound port 80 too.

**8. Updating the app later**
```bash
cd simple-secure-share
git pull
npm install
pm2 restart simple-secure-share
```

### Option B: AWS Elastic Beanstalk (more managed, less manual)

If you'd rather not SSH in and run commands by hand:
1. Install the [EB CLI](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3-install.html)
2. `eb init` (choose Node.js platform)
3. `eb create simple-secure-share-env`
4. Set environment variables (`JWT_SECRET`, `FILE_ENCRYPTION_KEY`) via `eb setenv KEY=value KEY2=value2`, or through the EB Console → Configuration → Software
5. `eb deploy` each time you push changes

Elastic Beanstalk handles the server provisioning, load balancing, and restarts for you, at the cost of being a bit more "black box" than a plain EC2 instance.

### A note on the JSON-file "database" in production
`data/db.json` lives on the EC2 instance's local disk. That's fine for a single instance, but:
- **Back it up** periodically (`scp` it down, or set up an EC2 snapshot schedule) since there's no redundancy.
- If you ever scale to multiple instances behind a load balancer, this JSON file approach breaks (each instance would have its own separate file). At that point, migrate to a real database — this is exactly the tradeoff this simple version makes in exchange for having nothing to install.

## Limitations (by design, for simplicity)

- Single JWT access token, no refresh-token rotation (sessions just last 7 days, then you log in again)
- JSON file instead of a real database — fine for light personal use, not for many concurrent users
- No admin panel, no folders, no audit log, no MFA
- No virus scanning on uploads

If you outgrow these limits, that's the point at which the full version (PostgreSQL, Docker, React, refresh tokens, audit logging, admin panel) becomes worth the extra setup complexity.

# ☁️ Todo Cloud App — Full-Stack Deployment on AWS EC2 (Free Tier)

Aplikasi Todo full-stack yang di-deploy otomatis ke AWS EC2 lewat pipeline CI/CD, dilengkapi monitoring, security, dan scaling.

- 🌍 **Live App:** `http://<EC2_PUBLIC_IP>`
- 📊 **Grafana:** `http://<EC2_PUBLIC_IP>:3000`
- ⚙️ **Pipeline:** tab *Actions* di repository ini

## Arsitektur

```
Internet ─▶ Nginx :80 ─┬─▶ Frontend (HTML statis)
                       └─▶ /api ─▶ Backend Node.js (1..N replika) ─▶ PostgreSQL
Prometheus ─scrape─▶ Backend /metrics + Node Exporter ─▶ Grafana :3000
```

| Layer | Teknologi |
|---|---|
| Frontend | HTML/JS + Nginx (reverse proxy) |
| Backend | Node.js 20, Express, helmet, rate-limit |
| Database | PostgreSQL 16 |
| CI/CD | GitHub Actions → GHCR → SSH deploy |
| Monitoring | Prometheus, Grafana, Node Exporter, JSON logs |
| Infra | AWS EC2 t2/t3.micro, Docker Compose |

## CI/CD Pipeline (`.github/workflows/ci-cd.yml`)

1. **test** — install, unit test, `npm audit`
2. **build** — build Docker image, push ke GitHub Container Registry (tag = commit SHA)
3. **deploy** — copy config ke EC2, `docker compose up -d`, health check

Pull request hanya menjalankan *test*; push ke `main` menjalankan seluruh pipeline.

## 🚀 Cara Deploy (langkah demi langkah)

### 1. Buat EC2 (Free Tier)
- AWS Console → EC2 → Launch instance
- AMI: **Ubuntu 22.04/24.04**, type: **t2.micro / t3.micro** (Free Tier eligible), storage 20 GB
- Buat **key pair** (`.pem`), simpan aman
- **Security Group:**

| Port | Sumber | Fungsi |
|---|---|---|
| 22 | 0.0.0.0/0 (key-only + fail2ban)* | SSH (dibutuhkan GitHub Actions) |
| 80 | 0.0.0.0/0 | Aplikasi |
| 3000 | *My IP* | Grafana |

\* IP runner GitHub Actions dinamis. Alternatif lebih ketat: pakai self-hosted runner dan batasi port 22 ke *My IP*.
- (Opsional) Alokasikan **Elastic IP** agar IP tidak berubah.

### 2. Setup server (sekali saja)
```bash
scp -i key.pem scripts/setup-ec2.sh ubuntu@<IP>:~
ssh -i key.pem ubuntu@<IP> "bash setup-ec2.sh"
```
Skrip memasang Docker, swap 2GB, UFW, fail2ban, dan membuat `~/app/.env` berisi password acak.

### 3. Push ke GitHub & isi Secrets
Repo → *Settings → Secrets and variables → Actions*:

| Secret | Isi |
|---|---|
| `EC2_HOST` | Public IP EC2 |
| `EC2_SSH_KEY` | Isi lengkap file `.pem` |

### 4. Deploy
```bash
git init && git add . && git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```
Buka tab **Actions** → tunggu hijau → akses `http://<IP>`.

## 🔐 Keamanan
- Secret **tidak** di kode: password DB/Grafana di `.env` server, kredensial deploy di GitHub Secrets
- Security Group + UFW membatasi port; Prometheus hanya `127.0.0.1`; `/metrics` diblok dari publik di Nginx
- `helmet` (security headers), rate limiting 100 req/menit/IP, validasi input, query terparameterisasi (anti SQL injection)
- Container backend berjalan sebagai **non-root**; `npm audit` di pipeline
- SSH key-only + fail2ban

## 📈 Monitoring
- **Log:** JSON terstruktur → `docker compose logs -f backend`
- **Dashboard Grafana** (auto-provisioned, login `admin` + `GRAFANA_PASSWORD` dari `~/app/.env`): request rate, latency p95, error 5xx, jumlah replika, CPU & memory host
- 📸 *Tempel screenshot dashboard di sini:* `docs/grafana.png`

## 🚀 Scaling
**Manual (horizontal):**
```bash
cd ~/app && docker compose up -d --scale backend=3
```
Nginx me-resolve DNS Docker tiap 5 detik sehingga trafik di-round-robin ke semua replika, dan Prometheus otomatis menemukan replika baru (lihat panel *Jumlah replika*).

**Load test (untuk screenshot):**
```bash
sudo apt-get install -y apache2-utils
ab -n 5000 -c 50 http://<IP>/api/todos
```
**Jalur produksi:** pindahkan ke ASG + ALB (EC2) atau ECS Fargate, database ke RDS.

## Struktur Repo
```
backend/     API Express + test + Dockerfile
frontend/    UI statis
nginx/       reverse proxy config
monitoring/  Prometheus & Grafana provisioning
scripts/     setup-ec2.sh
.github/workflows/ci-cd.yml
docker-compose.yml
```

## Catatan Biaya
Free Tier: 750 jam/bulan t2/t3.micro selama 12 bulan pertama. Hindari NAT Gateway/ALB (berbayar). Hentikan instance jika tidak dipakai.

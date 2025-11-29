# คู่มือการ Deploy ไปที่ Vercel

## วิธี Deploy

### 1. เตรียม Repository
```bash
# Commit และ push โค้ดขึ้น GitHub/GitLab/Bitbucket
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 2. Deploy บน Vercel

#### วิธีที่ 1: ใช้ Vercel CLI (แนะนำ)
```bash
# ติดตั้ง Vercel CLI
npm i -g vercel

# Login เข้า Vercel
vercel login

# Deploy (ในครั้งแรกจะถามคำถามเพื่อตั้งค่า)
vercel

# Deploy แบบ Production
vercel --prod
```

#### วิธีที่ 2: ใช้ Vercel Dashboard (Web UI)
1. ไปที่ [https://vercel.com](https://vercel.com)
2. Login เข้าด้วย GitHub/GitLab/Bitbucket account
3. คลิก "Add New Project"
4. Import repository ที่ต้องการ deploy
5. Vercel จะ auto-detect Next.js framework
6. ตั้งค่า Environment Variables (ดูด้านล่าง)
7. คลิก "Deploy"

### 3. ตั้งค่า Environment Variables ใน Vercel

ไปที่ **Project Settings > Environment Variables** และเพิ่มตัวแปรต่อไปนี้:

#### Database
```
DATABASE_URL
```
**ค่า**: MongoDB connection string (แนะนำใช้ MongoDB Atlas)
- ตัวอย่าง: `mongodb+srv://username:password@cluster.mongodb.net/marketplace?retryWrites=true&w=majority`

#### NextAuth
```
NEXTAUTH_URL
```
**ค่า**: URL ของเว็บไซต์ที่ deploy (จะได้จาก Vercel หลังจาก deploy)
- ตัวอย่าง: `https://your-project.vercel.app`
- **สำคัญ**: ต้องเปลี่ยนเป็น production URL ไม่ใช่ localhost

```
NEXTAUTH_SECRET
```
**ค่า**: Secret key สำหรับ NextAuth (สร้างด้วย `openssl rand -base64 32`)
- ตัวอย่าง: `abc123def456ghi789jkl012mno345pqr678stu901vwx234yz`

#### Discord OAuth (Optional)
```
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
```
**ค่า**: จาก Discord Developer Portal
- **สำคัญ**: ต้องตั้งค่า Redirect URI ใน Discord เป็น: `https://your-project.vercel.app/api/auth/callback/discord`

#### Omise Payment
```
OMISE_PUBLIC_KEY
OMISE_SECRET_KEY
```
**ค่า**: จาก Omise Dashboard
- ใช้ **Live Keys** สำหรับ Production
- ใช้ **Test Keys** สำหรับ Preview Deployments (ถ้าต้องการ)

#### GitHub (Optional)
```
GITHUB_TOKEN
```
**ค่า**: GitHub Personal Access Token
- ใช้สำหรับ API `/api/keys/verify` ถ้าไม่ตั้งค่า ระบบจะยังทำงานได้

### 4. ตั้งค่า Domain (Optional)

ถ้าต้องการใช้ custom domain:
1. ไปที่ **Project Settings > Domains**
2. เพิ่ม domain ที่ต้องการ
3. ตั้งค่า DNS records ตามที่ Vercel บอก
4. อัพเดท `NEXTAUTH_URL` เป็น custom domain

### 5. ตั้งค่า MongoDB Atlas (ถ้ายังไม่มี)

1. สร้าง account ที่ [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. สร้าง cluster (เลือก Free tier)
3. สร้าง Database User
4. Whitelist IP Address: `0.0.0.0/0` (อนุญาตทุก IP) หรือเฉพาะ Vercel IPs
5. คัดลอก Connection String
6. ตั้งค่า `DATABASE_URL` ใน Vercel Environment Variables

### 6. Setup Database Schema

หลังจาก deploy ครั้งแรก ต้อง push Prisma schema ไปที่ database:

#### วิธีที่ 1: ใช้ Vercel CLI
```bash
# Connect to your Vercel project
vercel link

# Run Prisma commands (ต้องมี DATABASE_URL ใน local .env)
npx prisma db push
```

#### วิธีที่ 2: ใช้ Vercel Functions
สามารถสร้าง API endpoint ชั่วคราวเพื่อรัน `prisma db push` หรือใช้ MongoDB Compass / MongoDB Atlas UI

#### วิธีที่ 3: ใช้ Prisma Studio (Local)
```bash
# ตั้งค่า DATABASE_URL ใน .env ให้ชี้ไปที่ production database
DATABASE_URL="mongodb+srv://..."

# Run Prisma Studio
npx prisma studio
```

### 7. ตรวจสอบการ Deploy

หลังจาก deploy สำเร็จ:
1. เปิดเว็บไซต์ที่ Vercel ให้ URL
2. ตรวจสอบว่าหน้าหลักโหลดได้
3. ทดสอบ Login/Register
4. ทดสอบการชำระเงิน (ใช้ Omise Test Keys ก่อน)

## Troubleshooting

### Build Failed
- ตรวจสอบว่า Environment Variables ทั้งหมดตั้งค่าแล้ว
- ตรวจสอบ Build Logs ใน Vercel Dashboard
- ตรวจสอบว่า `prisma generate` ทำงานได้ (จะรันอัตโนมัติผ่าน `postinstall` script)

### Database Connection Error
- ตรวจสอบว่า `DATABASE_URL` ถูกต้อง
- ตรวจสอบว่า MongoDB Atlas whitelist IP ของ Vercel แล้ว (หรือใช้ `0.0.0.0/0`)
- ตรวจสอบว่า database user มีสิทธิ์ในการเข้าถึง database

### NextAuth Error
- ตรวจสอบว่า `NEXTAUTH_URL` ตรงกับ production URL
- ตรวจสอบว่า `NEXTAUTH_SECRET` ตั้งค่าแล้ว
- ตรวจสอบว่า Redirect URIs ใน OAuth providers (เช่น Discord) ตั้งค่าถูกต้อง

### Prisma Schema Not Synced
- รัน `npx prisma db push` ผ่าน Vercel CLI หรือ local environment ที่เชื่อมต่อกับ production database

## หมายเหตุ

- **Environment Variables** ที่ตั้งค่าใน Vercel จะใช้ได้ในทุก Environment (Production, Preview, Development)
- สามารถตั้งค่าแยกกันได้สำหรับแต่ละ Environment
- การเปลี่ยนแปลง Environment Variables ต้อง **Redeploy** ถึงจะมีผล
- ใช้ **Preview Deployments** สำหรับทดสอบก่อน deploy ไป Production
- สำหรับ Production ควรใช้ **Live Keys** ของ Omise และ **Production Database**


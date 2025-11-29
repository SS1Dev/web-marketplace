# S1Dev Marketplace

ระบบ Marketplace สำหรับขาย Item/Code/Key พร้อมระบบชำระเงินด้วย Promptpay ผ่าน Omise

## Features

- 🔐 **ระบบ Authentication**
  - Login ด้วย Email/Password
  - Login ด้วย Discord (Optional)

- 👤 **ระบบ User**
  - ดูสินค้าและสั่งซื้อ
  - ดูประวัติการสั่งซื้อ
  - ติดตามสถานะการชำระเงิน

- 👨‍💼 **ระบบ Admin**
  - เพิ่ม/แก้ไข/ลบ สินค้า
  - Dashboard แสดงภาพรวมการขาย
  - ดูสถิติการขายแบบละเอียด

- 💳 **ระบบชำระเงิน**
  - ชำระเงินด้วย Promptpay ผ่าน Omise
  - แสดง QR Code สำหรับสแกนจ่าย
  - ตรวจสอบสถานะการชำระเงินอัตโนมัติ

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: SQLite (Prisma ORM)
- **Authentication**: NextAuth.js
- **Payment**: Omise (Promptpay)
- **UI**: Tailwind CSS + Shadcn UI
- **Styling**: Gaming-themed dark mode design

## Prerequisites

- Node.js 18+ 
- npm หรือ yarn
- MongoDB (Local หรือ MongoDB Atlas)
- Omise Account (สำหรับการชำระเงิน)

## Installation

1. Clone repository:
```bash
git clone <repository-url>
cd S1Dev
```

2. Install dependencies:
```bash
npm install
```

3. Setup environment variables:
```bash
cp env.template .env
# แก้ไขค่าใน .env ตามที่ต้องการ
```

4. Setup database:
```bash
# สร้าง MongoDB database (Local หรือใช้ MongoDB Atlas)
# ตั้งค่า DATABASE_URL ใน .env

# Generate Prisma Client
npx prisma generate

# Push schema to database
npx prisma db push
```

5. Run development server:
```bash
npm run dev
```

เปิดเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

## Environment Variables

ดูรายละเอียดในไฟล์ `env.template`

## Database

ระบบใช้ **MongoDB** เป็น database

### Database Schema

### User
- id (ObjectId), name, email, password, role (user/admin)
- รองรับ OAuth (Discord)

### Product
- id (ObjectId), name, description, price, stock, category, isActive

### Order
- id (ObjectId), userId, status, totalAmount, paymentMethod
- omiseChargeId, qrCodeUrl

### OrderItem
- id (ObjectId), orderId, productId, quantity, price, code, username, password

### Key
- id (ObjectId), key, orderId, orderItemId, productId, userId
- purchaseDate, expireDate, buyerName
- activateDate, hwid, placeId (จะได้เมื่อ verify)
- isActive

### KeyLog
- id (ObjectId), keyId, action, hwid, placeId
- success, message, ipAddress, userAgent, createdAt, username, password

### Key
- id (ObjectId), key, orderId, orderItemId, productId, userId
- purchaseDate, expireDate, buyerName
- activateDate, hwid, placeId (จะได้เมื่อ verify)
- isActive

### KeyLog
- id (ObjectId), keyId, action, hwid, placeId
- success, message, ipAddress, userAgent, createdAt

### MongoDB Setup

**Local MongoDB:**
```bash
# ติดตั้ง MongoDB Community Edition
# เริ่ม MongoDB service
# DATABASE_URL="mongodb://localhost:27017/marketplace"
```

**MongoDB Atlas (Cloud):**
1. สร้าง account ที่ https://www.mongodb.com/cloud/atlas
2. สร้าง cluster
3. ตั้งค่า database user
4. รับ connection string
5. `DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/marketplace?retryWrites=true&w=majority"`

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # Authentication
│   │   ├── orders/       # Order management
│   │   ├── payments/     # Payment processing
│   │   └── admin/        # Admin APIs
│   ├── admin/            # Admin pages
│   ├── products/         # Product pages
│   ├── orders/           # Order pages
│   └── login/            # Login page
├── components/           # React components
│   ├── ui/              # UI components (Shadcn)
│   └── ...              # Feature components
├── lib/                  # Utility functions
├── prisma/              # Database schema
└── types/               # TypeScript types
```

## Usage

### สำหรับ User

1. **Login**: เข้าสู่ระบบด้วย Email/Password หรือ Discord
2. **Browse Products**: ดูสินค้าที่มีในระบบ
3. **Purchase**: เลือกสินค้าและทำการสั่งซื้อ
4. **Payment**: สแกน QR Code เพื่อชำระเงิน
5. **View Orders**: ดูประวัติการสั่งซื้อและสถานะ

### สำหรับ Admin

1. **Login**: เข้าสู่ระบบด้วยบัญชี Admin
2. **Dashboard**: ดูภาพรวมการขาย สถิติ และรายการคำสั่งซื้อล่าสุด
3. **Manage Products**: เพิ่ม/แก้ไข/ลบ สินค้า
4. **View Analytics**: ดูรายละเอียดการขายทั้งหมด

## Payment Flow

1. User เลือกสินค้าและทำการสั่งซื้อ
2. ระบบสร้าง Order และเรียก Omise API เพื่อสร้าง Charge
3. แสดง QR Code ให้ User สแกน
4. ระบบตรวจสอบสถานะการชำระเงินอัตโนมัติ (Polling)
5. เมื่อชำระเงินสำเร็จ ระบบอัพเดทสถานะ Order และ Stock (สำหรับ non-key products)

## Key Management Flow

1. User ซื้อ Key Product และชำระเงินสำเร็จ
2. **ระบบ Generate Keys อัตโนมัติ** เมื่อ payment status เปลี่ยนเป็น "paid"
3. ระบบสร้าง Keys ตามจำนวนที่ซื้อ พร้อมคำนวณวันหมดอายุตาม Product.expireDays
4. User ดู Keys ได้ที่หน้า Order Detail ทันที
5. Admin สามารถดูและจัดการ Keys ได้ที่หน้า Key Management (`/admin/keys`)
6. เมื่อมีการ Verify Key:
   - บันทึก activateDate (ครั้งแรกเท่านั้น)
   - บันทึก HWID และ PlaceID
   - บันทึก Log ใน key_logs collection

## API Routes

### Authentication
- `POST /api/auth/[...nextauth]` - NextAuth endpoints

### Orders
- `POST /api/orders/create` - สร้าง Order ใหม่
- `GET /api/orders/[id]` - ดูรายละเอียด Order

### Payments
- `POST /api/payments/create` - สร้าง Payment และ QR Code
- `GET /api/payments/status` - ตรวจสอบสถานะการชำระเงิน

### Admin
- `POST /api/admin/products` - สร้าง Product
- `PUT /api/admin/products/[id]` - แก้ไข Product
- `DELETE /api/admin/products/[id]` - ลบ Product

### Keys
- `POST /api/keys/generate` - สร้าง Keys สำหรับ Order Item (Admin only)
  - Body: `{ orderId, orderItemId, quantity }`
  - Returns: `{ success, keys: [{ id, key, expireDate }] }`

- `GET /api/keys/verify` - Verify Key และ Activate (Public API)
  - Query Parameters: `?key=XXX&hwid=YYY&placeId=ZZZ&gameName=AAA&userId=BBB&userName=CCC` (ทั้งหมดเป็น optional ยกเว้น key)
  - Returns: `{ success, key: { id, key, activated, activateDate, expireDate, productName } }`

## Development

```bash
# Development
npm run dev

# Build
npm run build

# Start production
npm start

# Database
npm run db:generate  # Generate Prisma Client
npm run db:push      # Push schema to database
npm run db:studio    # Open Prisma Studio
```

## Security Notes

- ใช้ HTTPS ใน production
- เก็บ Secret Keys ใน environment variables
- ตรวจสอบสิทธิ์ Admin ก่อนเข้าถึง Admin routes
- Validate input data ด้วย Zod
- ใช้ Prisma ORM เพื่อป้องกัน SQL Injection

## Troubleshooting

### Database Issues
```bash
# Generate Prisma Client
npx prisma generate

# Push schema to database
npx prisma db push

# Open Prisma Studio (GUI for database)
npx prisma studio
```

### Payment Issues
- ตรวจสอบ Omise Keys ใน .env
- ตรวจสอบว่าใช้ Test Keys หรือ Production Keys
- ดู Logs ใน Omise Dashboard

## License

MIT

## Support

สำหรับคำถามหรือปัญหา กรุณาสร้าง Issue ใน Repository


# API Verify Key - วิธีใช้งาน

## Overview
API สำหรับตรวจสอบและเปิดใช้งาน Key (Token) เปลี่ยนจาก POST method เป็น GET method แล้ว

## Endpoint
```
GET /api/keys/verify
```

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | ✅ จำเป็น | Key ที่ต้องการตรวจสอบ |
| `hwid` | string | ❌ ไม่จำเป็น | Hardware ID (สำหรับล็อก Hardware) |
| `placeId` | string | ❌ ไม่จำเป็น | Place ID (สำหรับล็อก Place) |
| `gameName` | string | ❌ ไม่จำเป็น | ชื่อเกมที่ใช้ Key (หรือใช้ `GameName`) |
| `userId` | string | ❌ ไม่จำเป็น | User ID ของผู้ใช้ Key |
| `userName` | string | ❌ ไม่จำเป็น | ชื่อผู้ใช้ Key |

## Response Format

### Success Response (200 OK)
```json
{
  "success": true,
  "key": {
    "id": "key_id",
    "key": "ABC123-XYZ789",
    "activated": true,
    "activateDate": "2024-01-15T10:30:00.000Z",
    "expireDate": "2024-02-15T10:30:00.000Z",
    "productName": "Premium Package",
    "sourceCode": "print('Hello from key product')",
    "status": "active"
  }
}
```

### Error Responses

#### Invalid Key (404 Not Found)
```json
{
  "success": false,
  "error": "Invalid key"
}
```

#### Key is Inactive (400 Bad Request)
```json
{
  "success": false,
  "error": "Key is inactive"
}
```

#### Key has Expired (400 Bad Request)
```json
{
  "success": false,
  "error": "Key has expired"
}
```

#### Invalid Request Data (400 Bad Request)
```json
{
  "error": "Invalid request data",
  "details": [...]
}
```

## วิธีใช้งาน

### 1. ใช้งานด้วย cURL

#### ตรวจสอบ Key พื้นฐาน
```bash
curl "http://localhost:3000/api/keys/verify?key=ABC123-XYZ789"
```

#### ตรวจสอบ Key พร้อม HWID และ PlaceID
```bash
curl "http://localhost:3000/api/keys/verify?key=ABC123-XYZ789&hwid=HW123456&placeId=PLACE001"
```

#### ตรวจสอบ Key พร้อม HWID เท่านั้น
```bash
curl "http://localhost:3000/api/keys/verify?key=ABC123-XYZ789&hwid=HW123456"
```

#### ตรวจสอบ Key พร้อม GameName, userId, userName
```bash
curl "http://localhost:3000/api/keys/verify?key=ABC123-XYZ789&gameName=MyGame&userId=12345&userName=Player1"
```

#### ตรวจสอบ Key พร้อมทุก Parameters
```bash
curl "http://localhost:3000/api/keys/verify?key=ABC123-XYZ789&hwid=HW123456&placeId=PLACE001&gameName=MyGame&userId=12345&userName=Player1"
```

### 2. ใช้งานด้วย JavaScript/TypeScript (Fetch API)

```javascript
// ตรวจสอบ Key พื้นฐาน
async function verifyKey(key, options = {}) {
  const params = new URLSearchParams({
    key: key
  });
  
  if (options.hwid) {
    params.append('hwid', options.hwid);
  }
  
  if (options.placeId) {
    params.append('placeId', options.placeId);
  }
  
  if (options.gameName) {
    params.append('gameName', options.gameName);
  }
  
  if (options.userId) {
    params.append('userId', options.userId);
  }
  
  if (options.userName) {
    params.append('userName', options.userName);
  }
  
  const response = await fetch(`/api/keys/verify?${params.toString()}`);
  const data = await response.json();
  
  if (data.success) {
    console.log('Key verified:', data.key);
    return data;
  } else {
    console.error('Verification failed:', data.error);
    throw new Error(data.error);
  }
}

// ใช้งาน - พื้นฐาน
verifyKey('ABC123-XYZ789')
  .then(result => {
    console.log('Success:', result);
  })
  .catch(error => {
    console.error('Error:', error);
  });

// ใช้งาน - พร้อมทุก Parameters
verifyKey('ABC123-XYZ789', {
  hwid: 'HW123456',
  placeId: 'PLACE001',
  gameName: 'MyGame',
  userId: '12345',
  userName: 'Player1'
})
  .then(result => {
    console.log('Success:', result);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

### 3. ใช้งานด้วย Axios

```javascript
import axios from 'axios';

async function verifyKey(key, options = {}) {
  try {
    const params = {
      key: key
    };
    
    if (options.hwid) params.hwid = options.hwid;
    if (options.placeId) params.placeId = options.placeId;
    if (options.gameName) params.gameName = options.gameName;
    if (options.userId) params.userId = options.userId;
    if (options.userName) params.userName = options.userName;
    
    const response = await axios.get('/api/keys/verify', { params });
    return response.data;
  } catch (error) {
    console.error('Verification failed:', error.response?.data || error.message);
    throw error;
  }
}

// ใช้งาน - พร้อมทุก Parameters
verifyKey('ABC123-XYZ789', {
  hwid: 'HW123456',
  placeId: 'PLACE001',
  gameName: 'MyGame',
  userId: '12345',
  userName: 'Player1'
})
  .then(result => console.log('Success:', result))
  .catch(error => console.error('Error:', error));
```

### 4. ใช้งานใน Browser (URL แบบง่าย)

คุณสามารถเปิด URL ตรงๆ ใน Browser เพื่อทดสอบ:

```
http://localhost:3000/api/keys/verify?key=ABC123-XYZ789
```

หรือ

```
http://localhost:3000/api/keys/verify?key=ABC123-XYZ789&hwid=HW123456&placeId=PLACE001
```

หรือพร้อม GameName, userId, userName:

```
http://localhost:3000/api/keys/verify?key=ABC123-XYZ789&gameName=MyGame&userId=12345&userName=Player1
```

### 5. ใช้งานด้วย Python (requests)

```python
import requests

def verify_key(key, hwid=None, place_id=None, game_name=None, user_id=None, user_name=None):
    url = "http://localhost:3000/api/keys/verify"
    params = {"key": key}
    
    if hwid:
        params["hwid"] = hwid
    if place_id:
        params["placeId"] = place_id
    if game_name:
        params["gameName"] = game_name
    if user_id:
        params["userId"] = user_id
    if user_name:
        params["userName"] = user_name
    
    response = requests.get(url, params=params)
    return response.json()

# ใช้งาน - พร้อมทุก Parameters
result = verify_key(
    "ABC123-XYZ789",
    hwid="HW123456",
    place_id="PLACE001",
    game_name="MyGame",
    user_id="12345",
    user_name="Player1"
)
print(result)
```

## หมายเหตุสำคัญ

1. **Key จะถูก Activate อัตโนมัติ**: เมื่อ verify Key ครั้งแรก ระบบจะบันทึก `activateDate` และคำนวณ `expireDate` อัตโนมัติ
2. **HWID และ PlaceID**: ถ้าใส่ค่าเหล่านี้ ระบบจะบันทึกเพื่อใช้ล็อก Hardware หรือ Place
3. **GameName, userId, userName**: ค่าเหล่านี้จะถูกบันทึกใน KeyLog เพื่อใช้ในการติดตามและวิเคราะห์การใช้งาน
4. **URL Encoding**: ถ้า Key หรือ Parameters อื่นๆ มีอักขระพิเศษ ควรทำ URL encoding ก่อน เช่น:
   ```javascript
   const encodedKey = encodeURIComponent('ABC123-XYZ789');
   const encodedGameName = encodeURIComponent('My Game');
   ```
5. **Case Insensitive**: Key จะถูกแปลงเป็นตัวพิมพ์ใหญ่อัตโนมัติ
6. **Logging**: ทุกการ verify จะถูกบันทึกในระบบ KeyLog พร้อมข้อมูล GameName, userId, userName (ถ้ามี)

## ตัวอย่างการใช้งานแบบเต็ม

```javascript
async function verifyAndActivateKey(key, options = {}) {
  try {
    // สร้าง URL พร้อม query parameters
    const url = new URL('/api/keys/verify', window.location.origin);
    url.searchParams.set('key', key);
    
    if (options.hwid) url.searchParams.set('hwid', options.hwid);
    if (options.placeId) url.searchParams.set('placeId', options.placeId);
    if (options.gameName) url.searchParams.set('gameName', options.gameName);
    if (options.userId) url.searchParams.set('userId', options.userId);
    if (options.userName) url.searchParams.set('userName', options.userName);
    
    // ส่ง Request
    const response = await fetch(url.toString());
    const data = await response.json();
    
    // ตรวจสอบผลลัพธ์
    if (data.success) {
      console.log('✅ Key verified successfully!');
      console.log('Key ID:', data.key.id);
      console.log('Product:', data.key.productName);
      console.log('Status:', data.key.status);
      console.log('Expires:', data.key.expireDate);
      
      if (!data.key.activated) {
        console.log('🆕 Key activated for the first time!');
      }
      
      return data.key;
    } else {
      throw new Error(data.error || 'Verification failed');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// ใช้งาน - พร้อมทุก Parameters
verifyAndActivateKey('ABC123-XYZ789', {
  hwid: 'HW123456',
  placeId: 'PLACE001',
  gameName: 'MyGame',
  userId: '12345',
  userName: 'Player1'
})
  .then(key => {
    // ทำอะไรต่อเมื่อ verify สำเร็จ
    console.log('Key is valid until:', key.expireDate);
  })
  .catch(error => {
    // จัดการ error
    alert('Key verification failed: ' + error.message);
  });
```


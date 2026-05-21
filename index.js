const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = require('./server.cjs'); // เรียกหลังบ้านพรีเมียมของลุง

// ส่งออกตัวแปรเพื่อให้ Vercel นำไปรันระเบิดพอร์ตระบบคลาวด์เองอัตโนมัติ
module.exports = app;

// เผื่อลุงต้องการรันเทสบนคอมตัวเองควบคู่ไปด้วย
if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`🚀 Running on http://localhost:${port}`));
}

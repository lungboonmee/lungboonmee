const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// 1. ตั้งค่าโฟลเดอร์ views ให้แม่นยำที่สุดสำหรับ Vercel
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 2. Middleware จัดการไฟล์ Static และข้อมูลจาก Form
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. เชื่อมต่อ Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("⚠️ ไม่พบ SUPABASE_URL หรือ SUPABASE_KEY ใน Environment Variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 4. เส้นทางหน้าแรก (Home) - แก้ปัญหาภาพ image_a1fdba.png
app.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        // ส่งข้อมูล data (ซึ่งคือรายการงาน) ไปที่หน้า index.ejs
        res.render('index', { jobs: data || [] });
    } catch (err) {
        console.error('❌ Home Error:', err.message);
        res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูลหน้าแรกครับลุง");
    }
});

// 5. หน้าเพิ่มงาน (Admin) - แก้ปัญหาภาพ image_a1fd79.png
app.get('/admin', (req, res) => {
    // สั่งให้แสดงหน้า admin.ejs
    res.render('admin'); 
});

// 6. หน้า Dashboard สำหรับดูภาพรวมงาน
app.get('/dashboard', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.render('dashboard', { jobs: data || [] });
    } catch (err) {
        console.error('❌ Dashboard Error:', err.message);
        res.status(500).send('ไม่สามารถโหลดหน้า Dashboard ได้ครับลุง');
    }
});

// 7. จัดการกรณีเข้าหน้าเว็บที่ไม่มีอยู่จริง (404)
app.use((req, res) => {
    res.status(404).send('ไม่พบหน้าที่ลุงต้องการครับ ลองเช็กตัวสะกด URL อีกทีนะ');
});

// 8. เริ่มต้น Server (เฉพาะตอนทดสอบในเครื่อง)
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`🚀 แอปของลุงทำงานแล้วที่ http://localhost:${port}`);
    });
}

// ส่งออก app ให้ Vercel ใช้งาน
module.exports = app;
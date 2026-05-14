const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// 1. ตั้งค่าโฟลเดอร์ views ด้วย path.resolve (แก้ปัญหา Failed to lookup view ชัวร์ที่สุด)
// วิธีนี้จะช่วยให้ Vercel หาไฟล์ index.ejs ในโฟลเดอร์ views เจอแน่นอนครับ
app.set('views', path.resolve(__dirname, 'views')); 
app.set('view engine', 'ejs');

// 2. Middleware สำหรับจัดการไฟล์ Static และการรับค่าจาก Form
app.use(express.static(path.resolve(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. ตรวจสอบและเชื่อมต่อ Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("⚠️ ไม่พบ SUPABASE_URL หรือ SUPABASE_KEY ใน Environment Variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 4. เส้นทางหลัก (หน้าแรก) - ดึงข้อมูลงานซ่อม
app.get('/', async (req, res) => {
    try {
        const { data: jobs, error } = await supabase
            .from('jobs') 
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.render('index', { jobs: jobs || [] });
    } catch (err) {
        console.error('❌ Error fetching jobs:', err.message);
        res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลจากฐานข้อมูล');
    }
});

// 5. หน้า Dashboard สำหรับ Admin
app.get('/dashboard', async (req, res) => {
    try {
        const { data: jobs, error } = await supabase
            .from('jobs')
            .select('*');
        
        if (error) throw error;
        res.render('dashboard', { jobs: jobs || [] });
    } catch (err) {
        console.error('❌ Dashboard Error:', err.message);
        res.status(500).send('ไม่สามารถโหลดหน้า Dashboard ได้');
    }
});

// 6. จัดการกรณีเข้าหน้าเว็บที่ไม่มีอยู่จริง (404 Not Found)
app.use((req, res) => {
    res.status(404).send('ไม่พบหน้าที่ลุงต้องการครับ');
});

// 7. เริ่มต้น Server (สำหรับการทดสอบในเครื่อง)
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`🚀 แอปทำงานแล้วที่ http://localhost:${port}`);
    });
}

// บรรทัดนี้สำคัญที่สุดสำหรับ Vercel ครับ
module.exports = app;
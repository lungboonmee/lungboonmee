const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// 1. ตั้งค่าการเข้าถึงโฟลเดอร์ views ให้แม่นยำที่สุด (แก้ปัญหา Lookup View)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 2. ตั้งค่าให้แอปอ่านไฟล์ Static (CSS, รูปภาพ) จากโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. เชื่อมต่อ Supabase โดยใช้ค่าจาก Environment Variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 4. หน้าแรก (Index) - ดึงข้อมูลงานซ่อมมาโชว์
app.get('/', async (req, res) => {
    try {
        // ดึงข้อมูลจากตาราง 'jobs' (หรือชื่อตารางที่ลุงตั้งไว้ใน Supabase)
        const { data: jobs, error } = await supabase
            .from('jobs') 
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.render('index', { jobs: jobs || [] });
    } catch (err) {
        console.error('Error fetching jobs:', err);
        res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล: ' + err.message);
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
        res.status(500).send('Error loading dashboard');
    }
});

// 6. เริ่มต้น Server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app; // บรรทัดนี้สำคัญสำหรับการรันบน Vercel ครับ
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// 1. ตั้งค่าโฟลเดอร์ views ให้ Vercel รู้จักตำแหน่งไฟล์ .ejs ที่ถูกต้อง
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 2. Middleware สำหรับจัดการไฟล์ Static และการรับค่าจากฟอร์ม
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. เชื่อมต่อกับฐานข้อมูล Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 4. หน้าแรก (Home) - แก้ไขให้ส่งตัวแปร 'queue' ตามที่หน้า index.ejs เรียกใช้
app.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // เปลี่ยนชื่อจาก jobs เป็น queue เพื่อให้ตรงกับโค้ดใน index.ejs แถวที่ 36
        res.render('index', { queue: data || [] }); 
        
    } catch (err) {
        console.error('❌ Home Error:', err.message);
        res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูลครับลุง");
    }
});

// 5. หน้า Dashboard สำหรับ Admin
app.get('/dashboard', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // หน้า Dashboard ใช้ตัวแปรชื่อ jobs ตามโค้ดเดิมที่วางไว้
        res.render('dashboard', { jobs: data || [] });
    } catch (err) {
        console.error('❌ Dashboard Error:', err.message);
        res.status(500).send('ไม่สามารถโหลดหน้า Dashboard ได้ครับลุง');
    }
});

// 6. หน้าสำหรับเพิ่มงานใหม่ (Admin)
app.get('/admin', (req, res) => {
    res.render('admin'); 
});

// 7. จัดการกรณีเข้าหน้าเว็บที่ไม่มีอยู่จริง (404 Not Found)
app.use((req, res) => {
    res.status(404).send('ไม่พบหน้าที่ลุงต้องการครับ ลองเช็กตัวสะกด URL อีกทีนะ');
});

// 8. เริ่มต้น Server (สำหรับการรันเพื่อทดสอบในเครื่องตัวเอง)
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`🚀 แอปของลุงทำงานแล้วที่ http://localhost:${port}`);
    });
}

// ส่งออกแอปเพื่อให้ Vercel นำไปทำงานต่อได้
module.exports = app;
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

// 4. หน้าแรก (Home) - ดึงข้อมูลคิวงานมาโชว์
app.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // ส่งตัวแปร 'queue' ไปให้หน้า index.ejs
        res.render('index', { queue: data || [] }); 
        
    } catch (err) {
        console.error('❌ Home Error:', err.message);
        res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูลครับลุง");
    }
});

// 5. ระบบบันทึกงานใหม่ (API สำหรับลูกค้าแจ้งงานหน้าแรก)
app.post('/api/report-job', async (req, res) => {
    try {
        const { customer_name, phone, detail, is_member } = req.body;

        const { data, error } = await supabase
            .from('jobs')
            .insert([
                { 
                    customer_name: customer_name, 
                    phone: phone, 
                    detail: detail, 
                    is_member: is_member === 'on', 
                    status: 'Pending', 
                    created_at: new Date()
                }
            ]);

        if (error) throw error;

        res.send(`
            <script>
                alert('ส่งข้อมูลให้ลุงบุญมีเรียบร้อยแล้วครับ! ลุงจะติดต่อกลับไปโดยเร็วที่สุด');
                window.location.href = '/';
            </script>
        `);

    } catch (err) {
        console.error('❌ บันทึกงานผิดพลาด:', err.message);
        res.status(500).send('ขออภัยครับลุง ระบบบันทึกข้อมูลติดขัดนิดหน่อย ลองใหม่อีกครั้งนะครับ');
    }
});

// 6. หน้า Dashboard สำหรับ Admin
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

// 7. API สำหรับอัปเดตสถานะงาน (ใช้กับปุ่มในหน้า Dashboard)
app.post('/api/update-status', async (req, res) => {
    try {
        const { jobId, newStatus } = req.body;

        const { error } = await supabase
            .from('jobs')
            .update({ status: newStatus })
            .eq('id', jobId); // อัปเดตงานที่ ID ตรงกัน

        if (error) throw error;

        res.json({ success: true });
    } catch (err) {
        console.error('❌ Update Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8. หน้าสำหรับเพิ่มงานใหม่ (หน้า Admin เดิม)
app.get('/admin', (req, res) => {
    res.render('admin'); 
});

// 9. จัดการกรณีเข้าหน้าเว็บที่ไม่มีอยู่จริง (404 Not Found)
app.use((req, res) => {
    res.status(404).send('ไม่พบหน้าที่ลุงต้องการครับ ลองเช็กตัวสะกด URL อีกทีนะ');
});

// 10. เริ่มต้น Server (สำหรับการทดสอบในเครื่องตัวเอง)
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`🚀 แอปของลุงทำงานแล้วที่ http://localhost:${port}`);
    });
}

// ส่งออกแอปเพื่อให้ Vercel นำไปทำงานต่อได้
module.exports = app;
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer'); // สำหรับจัดการไฟล์รูป
require('dotenv').config();


const app = express();
const port = process.env.PORT || 3000;


// ตั้งค่า Multer (เก็บไฟล์ไว้ใน Memory ชั่วคราวก่อนส่งไป Supabase)
const upload = multer({ storage: multer.memoryStorage() });


// 1. ตั้งค่า View Engine และตำแหน่งไฟล์ .ejs
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


// 2. Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// 3. เชื่อมต่อกับ Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);


// ---------------------------------------------------------
// [ส่วนหน้าจอแสดงผล - ต้องอยู่ก่อน 404]
// ---------------------------------------------------------


// ก. หน้าแรก (Home) - ดึงข้อมูลคิวงานมาโชว์
app.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false });


        if (error) throw error;
        res.render('index', { queue: data || [] });
       
    } catch (err) {
        console.error('❌ Home Error:', err.message);
        res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูลครับลุง");
    }
});


// ข. หน้าจัดการงาน (Admin) - แก้ไขจุดชื่อตัวแปรให้ตรงกับ admin.ejs
app.get('/admin', async (req, res) => {
    try {
        const jobId = req.query.id; // ดึงเลข ID งานจากปุ่มแก้ไข
        if (!jobId) return res.redirect('/');


        // ดึงข้อมูลงาน
        const { data: job, error: jobError } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .single();


        // ดึงขั้นตอนงาน (Timeline)
        const { data: steps, error: stepError } = await supabase
            .from('job_steps')
            .select('*')
            .eq('job_id', jobId)
            .order('step_order', { ascending: true });


        if (jobError) throw jobError;


        // *** จุดที่แก้ไข: เปลี่ยนจาก steps: steps เป็น job_steps: steps ให้ตรงกับ admin.ejs ***
        res.render('admin', {
            job: job,
            job_steps: steps || []
        });


    } catch (err) {
        console.error('❌ Admin Error:', err.message);
        res.status(500).send("หน้าแก้ไขมีปัญหาครับลุง เช็คตาราง job_steps ใน Supabase หรือยังครับ?");
    }
});


// ค. หน้า Dashboard (Admin) - ดึงงานและขั้นตอนงานมาแสดง
app.get('/dashboard', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('jobs')
            .select('*, job_steps (*)')
            .order('created_at', { ascending: false });
       
        if (error) throw error;
        res.render('dashboard', { jobs: data || [] });
    } catch (err) {
        res.status(500).send('โหลด Dashboard ไม่ได้ครับลุง');
    }
});


// ---------------------------------------------------------
// [ส่วน API สำหรับทำงานหลังบ้าน]
// ---------------------------------------------------------


// API อัปโหลดรูปภาพ
app.post('/api/upload-photo', upload.single('photo'), async (req, res) => {
    try {
        const { jobId, stepId } = req.body;
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'ลุงลืมเลือกรูปครับ' });


        // สร้างชื่อไฟล์ใหม่
        const fileName = `${jobId}/${Date.now()}-${file.originalname}`;
       
        // 1. ส่งรูปไปที่ Storage ของ Supabase (Bucket: job-photos)
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('job-photos')
            .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });


        if (uploadError) throw uploadError;


        // 2. ดึง URL ของรูปที่เพิ่งอัปโหลด
        const { data: urlData } = supabase.storage.from('job-photos').getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;


        // 3. บันทึก URL ลงในตาราง job_steps และเปลี่ยนสถานะเป็น เสร็จแล้ว (is_done: true)
        const { error: updateError } = await supabase
            .from('job_steps')
            .update({
                photo_url: publicUrl,
                is_done: true
            })
            .eq('id', stepId);


        if (updateError) throw updateError;
        res.json({ success: true, url: publicUrl });
    } catch (err) {
        console.error('❌ Upload Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});


// API ระบบบันทึกงานใหม่
app.post('/api/report-job', async (req, res) => {
    try {
        const { customer_name, phone, detail, is_member } = req.body;
        const { error } = await supabase
            .from('jobs')
            .insert([{ customer_name, phone, detail, is_member: is_member === 'on', status: 'Pending' }]);


        if (error) throw error;
        res.send(`<script>alert('ส่งข้อมูลเรียบร้อยแล้วครับลุง!'); window.location.href = '/';</script>`);
    } catch (err) {
        res.status(500).send('ระบบติดขัดนิดหน่อยครับลุง');
    }
});


// API อัปเดตสถานะงาน
app.post('/api/update-status', async (req, res) => {
    try {
        const { jobId, newStatus } = req.body;
        const { error } = await supabase.from('jobs').update({ status: newStatus }).eq('id', jobId);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// ---------------------------------------------------------
// [ส่วนปิดท้าย - ต้องอยู่ล่างสุดเสมอ]
// ---------------------------------------------------------


app.use((req, res) => res.status(404).send('ไม่พบหน้าครับลุง'));


if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`🚀 แอปของลุงทำงานแล้วที่ http://localhost:${port}`);
    });
}


module.exports = app;


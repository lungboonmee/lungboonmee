const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const session = require('express-session');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

// ==========================================
// 1. SECURITY & MIDDLEWARE SETUP (ปลดบล็อกดีไซน์)
// ==========================================
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false
}));
app.disable('x-powered-by'); 

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// ระบบ Middleware บังคับล้างแคช เพื่อแก้ปัญหาหน้าแรกไม่อัปเดตเรียลไทม์
const noCache = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
};

// ==========================================
// 2. SESSION SETUP
// ==========================================
app.use(session({
    secret: process.env.SESSION_SECRET || 'boonmee_luxury_engineering_2026_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// ==========================================
// 3. DATABASE CONNECTION (SUPABASE)
// ==========================================
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Error: กรุณาตั้งค่า SUPABASE_URL และ SUPABASE_ANON_KEY ในไฟล์ .env');
    process.exit(1);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ==========================================
// 4. CORE ROUTING (หน้าร้านหลัก & แผงแอดมิน)
// ==========================================

// หน้าแรกของสมาชิก: แปลงสถานะเป็นไทย และพ่วงความเห็นล่าสุดจากแอดมิน
app.get('/', noCache, async (req, res) => {
    try {
        const { data: rawJobs } = await supabase
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false });

        const { data: announcements } = await supabase
            .from('announcements')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        const jobs = (rawJobs || []).map(job => {
            let thaiStatus = '⏳ รอคิว';
            let statusLower = (job.status || '').toLowerCase().trim();
            
            if (statusLower === 'in-progress' || statusLower === 'in_progress' || statusLower === 'กำลังดำเนินการ') {
                thaiStatus = '⚡ กำลังทำ';
            } else if (statusLower === 'completed' || statusLower === 'เสร็จสิ้น') {
                thaiStatus = '✅ เสร็จสิ้น';
            }

            return {
                ...job,
                thai_status: thaiStatus,
                last_comment: job.last_comment || 'ช่างกำลังจัดเตรียมคิวงานเพื่อเข้าดำเนินการครับ'
            };
        });

        res.render('index', { 
            jobs: jobs, 
            announcements: announcements || [] 
        });
    } catch (err) {
        console.error("Error loading home page:", err.message);
        res.render('index', { jobs: [], announcements: [] });
    }
});

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// บอร์ดจัดการแอดมิน: โหลดผ่าน SSR ดึงค่าสดใหม่จากฐานข้อมูลตรงๆ ไม่พึ่ง API วนซ้ำ
app.get('/dashboard', noCache, async (req, res) => {
    try {
        const { data: jobsData, error: jobsError } = await supabase
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false });

        if (jobsError) throw jobsError;
        const safeJobs = jobsData || [];

        const checkStatus = (job, target) => {
            const status = (job.status || '').toLowerCase().replace(/[^a-zA-Z0-9ก-์]/g, '').trim();
            if (target === 'pending') return status === 'pending' || status === 'กำลังรอคิว' || status === 'รอดำเนินการ';
            if (target === 'in_progress') return status === 'inprogress' || status === 'in-progress' || status === 'กำลังดำเนินการ';
            if (target === 'completed') return status === 'completed' || status === 'เสร็จสิ้น';
            return false;
        };

        const jobsSummary = {
            all: safeJobs,
            pending: safeJobs.filter(j => checkStatus(j, 'pending')),
            inProgress: safeJobs.filter(j => checkStatus(j, 'in_progress')),
            completed: safeJobs.filter(j => checkStatus(j, 'completed'))
        };

        const { data: announcementsData } = await supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false });

        res.render('dashboard', { 
            jobs: safeJobs, 
            jobsSummary: jobsSummary,
            announcements: announcementsData || []
        });
    } catch (err) {
        res.status(500).send("ระบบขัดข้อง: " + err.message);
    }
});

// API สถิติชุดข้อมูลคู่ขนานข้ามแคช
app.get('/api/dashboard-data', noCache, async (req, res) => {
    try {
        const { data: jobsData, error: jobsError } = await supabase
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false });

        if (jobsError) throw jobsError;
        const safeJobs = jobsData || [];

        const checkStatus = (job, target) => {
            const status = (job.status || '').toLowerCase().replace(/[^a-zA-Z0-9ก-์]/g, '').trim();
            if (target === 'pending') return status === 'pending' || status === 'กำลังรอคิว' || status === 'รอดำเนินการ';
            if (target === 'in_progress') return status === 'inprogress' || status === 'in-progress' || status === 'กำลังดำเนินการ';
            if (target === 'completed') return status === 'completed' || status === 'เสร็จสิ้น';
            return false;
        };

        const jobsSummary = {
            all: safeJobs,
            pending: safeJobs.filter(j => checkStatus(j, 'pending')),
            inProgress: safeJobs.filter(j => checkStatus(j, 'in_progress')),
            completed: safeJobs.filter(j => checkStatus(j, 'completed'))
        };

        const { data: announcementsData } = await supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false });

        res.json({ 
            jobsSummary,
            announcements: announcementsData || []
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// 5. API ระบบยืนยันตัวตน (ADMIN LOGIN)
// ==========================================
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === '1234') {
        return res.json({ success: true, token: 'boonmee_secret_luxury_token_2026' });
    }
    res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง!' });
});

// ==========================================
// 6. API ระบบแจ้งงานใหม่
// ==========================================
app.post('/api/jobs', async (req, res) => {
    const { customer_name, phone, detail, price, is_member } = req.body;
    try {
        const { error } = await supabase
            .from('jobs')
            .insert([{ 
                customer_name, 
                phone, 
                detail, 
                price: price ? parseFloat(price) : 0, 
                price_status: 'Waiting', 
                is_member: is_member === true || is_member === 'true', 
                status: 'Pending' 
            }]);

        if (error) throw error;
        res.status(201).json({ success: true, message: 'บันทึกคิวงานเรียบร้อยแล้ว' });
    } catch (err) { 
        res.status(500).json({ success: false, error: err.message }); 
    }
});

// ==========================================
// 7. APIS ระบบจัดการประกาศ (ANNOUNCEMENT CRUD)
// ==========================================
app.post('/api/announcements', async (req, res) => {
    const { title, content } = req.body;
    try {
        const { error } = await supabase
            .from('announcements')
            .insert([{ title, content, is_active: true }]);

        if (error) throw error;
        res.status(201).json({ success: true, message: 'สร้างข่าวประกาศสำเร็จแล้วครับลุง!' });
    } catch (err) { 
        res.status(500).json({ success: false, error: err.message }); 
    }
});

app.post('/api/announcements/edit', async (req, res) => {
    const { id, title, content, is_active } = req.body;
    try {
        const { error } = await supabase
            .from('announcements')
            .update({ 
                title, 
                content, 
                is_active: is_active === undefined ? true : is_active,
                updated_at: new Date() 
            })
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'แก้ไขข่าวประกาศเรียบร้อยแล้วครับ' });
    } catch (err) { 
        res.status(500).json({ success: false, error: err.message }); 
    }
});

app.post('/api/announcements/delete', async (req, res) => {
    const { id } = req.body;
    try {
        const { error } = await supabase
            .from('announcements')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'ลบข่าวประกาศเรียบร้อยแล้ว' });
    } catch (err) { 
        res.status(500).json({ success: false, error: err.message }); 
    }
});

/**
 * 🌟 🛠️ จุดแก้ไขสำคัญที่สุด: ปลดล็อกปัญหาหลังบ้านปฏิเสธข้อมูล (Error 500)
 * แมตช์ตามโครงสร้าง UUID ของตาราง jobs และจัดแปลงค่าประเภท String ลงตาราง job_logs ครบถ้วน
 */
app.post('/api/update-status', async (req, res) => {
  try {
    const { jobId, newStatus, comment } = req.body;

    if (!jobId || !newStatus || !comment) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลและบันทึกความเห็นให้ครบถ้วนครับลุงบุญมี' });
    }

    console.log(`[ระบบหลังบ้านลุงบุญมี] กำลังอัปเดตงานรหัส UUID: ${jobId} -> สเตตัส: ${newStatus}`);

    // 1. อัปเดตข้อมูลลงตารางหลัก public.jobs (เปลี่ยนสเตตัสภาษาอังกฤษ พร้อมเก็บคอมเมนต์โชว์หน้าแรกทันที)
    const { error: jobUpdateError } = await supabase
      .from('jobs')
      .update({ 
          status: newStatus,
          last_comment: comment
      })
      .eq('id', jobId); // ค้นหาตรงตามรหัส id (uuid) ของตารางจริง

    if (jobUpdateError) {
      console.error('❌ Supabase jobs update error:', jobUpdateError.message);
      return res.status(500).json({ success: false, message: 'ตารางงานหลักปฏิเสธการอัปเดต: ' + jobUpdateError.message });
    }

    // 2. บันทึกข้อมูลประวัติไทม์ไลน์แตกแถวลงตารางย่อย public.job_logs
    const { error: logInsertError } = await supabase
      .from('job_logs')
      .insert([
        { 
          job_id: String(jobId), // แปลงจากประเภท uuid ในโปรแกรมให้เป็น text ตัวอักษรเข้าล็อกตามโครงสร้างตารางเป๊ะๆ
          status: newStatus, 
          comment: comment 
        }
      ]);

    if (logInsertError) {
      console.error('⚠️ Supabase job_logs insert warning:', logInsertError.message);
    }

    return res.status(200).json({ success: true, message: 'อัปเดตข้อมูล และส่งบันทึกความเห็นสำเร็จแล้วครับลุง!' });

  } catch (error) {
    console.error('❌ Full Backend System Error:', error);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการประมวลผลข้อมูลระบบหลังบ้าน' });
  }
});

module.exports = app;

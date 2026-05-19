const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const session = require('express-session'); // 1. เพิ่มตัวจัดการ Session
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const upload = multer({ storage: multer.memoryStorage() });

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 2. ตั้งค่ากุญแจล็อคระบบ (Session Middleware)
app.use(session({
    secret: 'lungboonmee_super_secret', // รหัสลับสำหรับเซสชัน
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // ถ้าใช้ Vercel (https) ในอนาคตค่อยเปลี่ยนเป็น true
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- 3. ฟังก์ชันตรวจสอบสิทธิ์ (Middleware) ---
// ถ้าใครพยายามเข้าหน้า Dashboard โดยไม่ผ่านการ Login จะโดนเด้งไปหน้าแรกหรือหน้า Login ทันที
const requireAuth = (req, res, next) => {
    if (!req.session.isLoggedIn) {
        return res.send(`<script>alert('เฉพาะลุงบุญมีเท่านั้นที่เข้าได้ครับ!'); window.location.href = '/login';</script>`);
    }
    next();
};

// ---------------------------------------------------------
// [ส่วนหน้าจอแสดงผล]
// ---------------------------------------------------------

app.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        // ส่งสถานะ login ไปที่หน้าแรกด้วย เพื่อโชว์ปุ่ม เข้า/ออก ระบบ
        res.render('index', { 
            queue: data || [], 
            isLoggedIn: req.session.isLoggedIn 
        }); 
    } catch (err) {
        res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูลครับลุง");
    }
});

// หน้า Login
app.get('/login', (req, res) => {
    res.render('login'); // ลุงต้องสร้างไฟล์ views/login.ejs นะครับ
});

// ระบบตรวจสอบการ Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // ลุงกำหนดรหัสผ่านที่ต้องการตรงนี้ได้เลยครับ
    if (username === 'admin' && password === '1234') { 
        req.session.isLoggedIn = true;
        req.session.user = 'ลุงบุญมี';
        res.redirect('/dashboard');
    } else {
        res.send(`<script>alert('รหัสผิดครับลุง!'); window.location.href = '/login';</script>`);
    }
});

// ระบบออกจากระบบ
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ก. หน้า Dashboard - เพิ่ม requireAuth เพื่อล็อคหน้าไว้
app.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('jobs')
            .select('*, job_steps (*)')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.render('dashboard', { 
            jobs: data || [],
            user: req.session.user 
        });
    } catch (err) {
        res.status(500).send('โหลด Dashboard ไม่ได้ครับลุง');
    }
});

// ข. หน้าจัดการงาน (Admin) - เพิ่ม requireAuth กันคนแอบมาแก้สถานะ
app.get('/admin', requireAuth, async (req, res) => {
    try {
        const jobId = req.query.id;
        if (!jobId) return res.redirect('/');

        const { data: job, error: jobError } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        const { data: steps, error: stepError } = await supabase
            .from('job_steps')
            .select('*')
            .eq('job_id', jobId)
            .order('step_order', { ascending: true });

        if (jobError) throw jobError;

        res.render('admin', { 
            job: job, 
            job_steps: steps || [] 
        });
    } catch (err) {
        res.status(500).send("หน้าแก้ไขมีปัญหาครับลุง");
    }
});

// --- API ต่างๆ คงเดิม แต่เพิ่ม requireAuth ในส่วนที่สำคัญ ---
app.post('/api/update-status', requireAuth, async (req, res) => { /* ... โค้ดเดิม ... */ });
app.post('/api/upload-photo', requireAuth, async (req, res) => { /* ... โค้ดเดิม ... */ });

// API สำหรับคนทั่วไปส่งงาน (ไม่ต้องใส่ requireAuth)
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

app.use((req, res) => res.status(404).send('ไม่พบหน้าครับลุง'));

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`🚀 แอปของลุงทำงานแล้วที่ http://localhost:${port}`);
    });
}

module.exports = app;
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const session = require('express-session');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// ตั้งค่า Multer
const upload = multer({ storage: multer.memoryStorage() });

// ตั้งค่า View Engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ตั้งค่า Session
app.use(session({
    secret: 'lungboonmee_super_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// เชื่อมต่อ Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Middleware ตรวจสอบสิทธิ์
const requireAuth = (req, res, next) => {
    if (!req.session.isLoggedIn) {
        return res.send(`<script>alert('เฉพาะลุงบุญมีเท่านั้นที่เข้าได้ครับ!'); window.location.href = '/login';</script>`);
    }
    next();
};

// --- ROUTES ---

// หน้าแรก
app.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.render('index', { queue: data || [], isLoggedIn: req.session.isLoggedIn });
    } catch (err) {
        res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูลครับลุง");
    }
});

// หน้า Login
app.get('/login', (req, res) => res.render('login'));

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === '1234') {
        req.session.isLoggedIn = true;
        req.session.user = 'ลุงบุญมี';
        res.redirect('/dashboard');
    } else {
        res.send(`<script>alert('รหัสผิดครับลุง!'); window.location.href = '/login';</script>`);
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// หน้า Dashboard (ดึงข้อมูลครบ 161 แถว)
app.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.render('dashboard', { jobs: data || [], user: req.session.user });
    } catch (err) {
        res.status(500).send('โหลด Dashboard ไม่ได้ครับลุง');
    }
});

// หน้า Admin จัดการงาน
app.get('/admin', requireAuth, async (req, res) => {
    try {
        const jobId = req.query.id;
        if (!jobId) return res.redirect('/');
        const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).single();
        const { data: steps } = await supabase.from('job_steps').select('*').eq('job_id', jobId).order('step_order', { ascending: true });
        res.render('admin', { job, job_steps: steps || [] });
    } catch (err) {
        res.status(500).send("หน้าแก้ไขมีปัญหาครับลุง");
    }
});

// API ต่างๆ
app.post('/api/update-status', requireAuth, async (req, res) => {
    const { id, status } = req.body;
    await supabase.from('jobs').update({ status }).eq('id', id);
    res.redirect('/dashboard');
});

app.post('/api/report-job', async (req, res) => {
    const { customer_name, phone, detail, is_member } = req.body;
    await supabase.from('jobs').insert([{ customer_name, phone, detail, is_member: is_member === 'on', status: 'Pending' }]);
    res.send(`<script>alert('ส่งข้อมูลเรียบร้อยแล้วครับลุง!'); window.location.href = '/';</script>`);
});

app.use((req, res) => res.status(404).send('ไม่พบหน้าครับลุง'));

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => console.log(`🚀 แอปของลุงทำงานแล้วที่ http://localhost:${port}`));
}

module.exports = app;
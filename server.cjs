const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const session = require('express-session');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// --- Config ล้ำสมัย ---
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ระบบ Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'lungboonmee_premium_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 3600000 
    }
}));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// --- Auth Middleware ---
const requireAuth = (req, res, next) => {
    if (!req.session.isLoggedIn) return res.redirect('/login');
    next();
};

// --- ROUTES: Login & Auth ---
app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === '1234') {
        req.session.isLoggedIn = true;
        req.session.user = 'ลุงบุญมี';
        return res.redirect('/dashboard');
    }
    res.render('login', { error: 'รหัสผ่านไม่ถูกต้องครับลุง!' });
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

// --- ROUTES: Dashboard & Admin ---
app.get('/dashboard', requireAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { data: jobs } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    res.render('dashboard', { jobs: jobs || [], user: req.session.user });
});

// เพิ่มส่วน Admin ที่ดึงข้อมูล 3 ตารางสัมพันธ์กัน
app.get('/admin', requireAuth, async (req, res) => {
    const jobId = req.query.id;
    try {
        const [jobRes, stepsRes, matsRes] = await Promise.all([
            supabase.from('jobs').select('*').eq('id', jobId).single(),
            supabase.from('job_steps').select('*').eq('job_id', jobId).order('step_name'),
            supabase.from('job_materials').select('*').eq('job_id', jobId)
        ]);
        res.render('admin', { 
            job: jobRes.data, 
            job_steps: stepsRes.data || [], 
            job_materials: matsRes.data || [] 
        });
    } catch (err) {
        res.status(500).send("ดึงข้อมูลเชิงลึกไม่ได้ครับลุง");
    }
});

// --- Routes อื่นๆ ---
app.get('/', (req, res) => res.render('index'));

// Vercel ใช้ Export แทน app.listen ในบางกรณี แต่ถ้าใช้ server.cjs ปกติให้เก็บไว้ครับ
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => console.log(`🚀 Premium Server running on port ${port}`));
}

module.exports = app;
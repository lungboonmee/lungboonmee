const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const session = require('express-session');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// --- Middlewares & Config ---
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'lungboonmee_super_secret_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const requireAuth = (req, res, next) => {
    if (!req.session.isLoggedIn) return res.redirect('/login');
    next();
};

// --- ROUTES ---

// Dashboard พร้อมระบบป้องกัน Cache (แก้ปัญหาหน้าบ้านไม่เปลี่ยน)
app.get('/dashboard', requireAuth, async (req, res) => {
    // เพิ่มบรรทัดนี้เพื่อป้องกัน Cache ทำให้ข้อมูลไม่เป็นปัจจุบัน
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    
    try {
        const { data: jobs, error } = await supabase
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.render('dashboard', { jobs: jobs || [], user: req.session.user });
    } catch (err) {
        res.status(500).send('โหลดข้อมูลไม่ได้ครับลุง');
    }
});

// [ล้ำสมัย] API อัปเดตสถานะงานแบบ Instant Refresh
app.post('/api/update-status', requireAuth, async (req, res) => {
    const { id, status } = req.body;
    try {
        await supabase.from('jobs').update({ status }).eq('id', id);
        
        // ใช้ 303 Redirect เพื่อบังคับให้โหลดข้อมูลใหม่ทันที
        res.redirect(303, '/dashboard');
    } catch (err) {
        res.status(500).send("อัปเดตไม่ได้ครับลุง");
    }
});

// Admin Route (ดึงข้อมูล 3 ตารางสัมพันธ์กัน)
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

// --- Default Routes ---
app.get('/', async (req, res) => {
    const { data } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    res.render('index', { queue: data || [], isLoggedIn: !!req.session.isLoggedIn });
});

app.post('/api/login', (req, res) => {
    if (req.body.username === 'admin' && req.body.password === '1234') {
        req.session.isLoggedIn = true;
        req.session.user = 'ลุงบุญมี';
        res.redirect('/dashboard');
    } else res.send('รหัสผ่านผิดครับลุง!');
});

app.listen(port, () => console.log(`🚀 Server is running on port ${port}`));
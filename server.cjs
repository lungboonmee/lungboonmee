const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const session = require('express-session');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// --- 1. ตั้งค่าพื้นฐาน (Configuration) ---
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- 2. ตั้งค่าระบบ Session แบบละเอียด (Session Management) ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'lungboonmee_ultra_secure_2026',
    name: 'lungboonmee.sid',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // ให้ระบบจำลุงได้ 24 ชั่วโมง
    }
}));

// --- 3. เชื่อมต่อ Supabase ---
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// --- 4. ฟังก์ชันป้องกันคนแอบเข้าหลังบ้าน (Middleware) ---
const requireAuth = (req, res, next) => {
    if (req.session && req.session.isLoggedIn) {
        return next();
    }
    res.redirect('/login');
};

// --- 5. เส้นทางสำหรับหน้า Login (Authentication Routes) ---
app.get('/login', (req, res) => {
    if (req.session.isLoggedIn) return res.redirect('/dashboard');
    res.render('login', { error: null });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // ระบบตรวจสอบสิทธิ์ (ในอนาคตเปลี่ยนเป็นเช็คตาราง users ใน Supabase ได้)
    if (username === 'admin' && password === '1234') {
        req.session.isLoggedIn = true;
        req.session.user = username;
        return res.redirect('/dashboard');
    }
    res.render('login', { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้องครับลุง!' });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// --- 6. เส้นทางหน้า Dashboard (Main Data View) ---
app.get('/dashboard', requireAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const { data: jobs, error } = await supabase
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.render('dashboard', { jobs: jobs || [], user: req.session.user });
    } catch (err) {
        res.status(500).send("ดึงข้อมูลหลักไม่ได้ครับลุง: " + err.message);
    }
});

// --- 7. เส้นทางหน้า Admin (Data Details - ขั้นสูง) ---
app.get('/admin', requireAuth, async (req, res) => {
    const { id } = req.query;
    if (!id) return res.redirect('/dashboard');
    
    try {
        // ดึงข้อมูลแบบ Promise.all เพื่อความเร็วสูงสุด
        const [job, steps, materials] = await Promise.all([
            supabase.from('jobs').select('*').eq('id', id).single(),
            supabase.from('job_steps').select('*').eq('job_id', id),
            supabase.from('job_materials').select('*').eq('job_id', id)
        ]);

        res.render('admin', { 
            job: job.data, 
            steps: steps.data || [], 
            materials: materials.data || [] 
        });
    } catch (err) {
        res.status(500).send("Error Loading Admin Data");
    }
});

// --- 8. หน้าหลัก (Landing Page) ---
app.get('/', (req, res) => {
    res.render('index');
});

// --- 9. เริ่มรันเซิร์ฟเวอร์ ---
app.listen(port, () => {
    console.log(`Server is fully operational on port ${port}`);
});
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

// ระบบ Session แบบปลอดภัยสำหรับ Production
app.use(session({
    secret: process.env.SESSION_SECRET || 'lungboonmee_premium_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 3600000 // ให้ Login ค้างไว้ได้ 1 ชม.
    }
}));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// --- Auth Middleware ---
const requireAuth = (req, res, next) => {
    if (!req.session.isLoggedIn) return res.redirect('/login');
    next();
};

// --- ROUTES: Login & Authentication ---
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // ลุงสามารถปรับเปลี่ยน Logic ตรงนี้เพื่อเช็คกับ Database จริงๆ ได้ครับ
    if (username === 'admin' && password === '1234') {
        req.session.isLoggedIn = true;
        req.session.user = 'ลุงบุญมี';
        return res.redirect('/dashboard');
    }
    res.render('login', { error: 'รหัสผ่านไม่ถูกต้องครับลุง!' });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// --- ROUTES: Dashboard (ที่มีระบบป้องกัน Cache) ---
app.get('/dashboard', requireAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { data: jobs } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    res.render('dashboard', { jobs: jobs || [], user: req.session.user });
});

// --- Routes อื่นๆ ---
app.get('/', (req, res) => res.render('index'));

app.listen(port, () => console.log(`🚀 Premium Server is running on port ${port}`));
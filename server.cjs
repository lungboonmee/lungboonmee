const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const session = require('express-session');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// ตั้งค่า EJS และ Static files
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// ระบบ Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'lungboonmee_final_2026',
    resave: false,
    saveUninitialized: false
}));

// เชื่อมต่อ Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Routes
app.get('/', (req, res) => res.render('index'));
app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === '1234') {
        req.session.isLoggedIn = true;
        return res.redirect('/dashboard');
    }
    res.render('login', { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง!' });
});

// ส่วนนี้คือคิวงานที่ลุงต้องการ (แก้ไขให้เสถียรขึ้น)
app.get('/dashboard', async (req, res) => {
    if (!req.session.isLoggedIn) return res.redirect('/login');
    
    try {
        const { data: jobs, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.render('dashboard', { jobs: jobs || [] });
    } catch (err) {
        res.status(500).send("ดึงข้อมูลคิวงานไม่ได้ครับลุง: " + err.message);
    }
});

module.exports = app;
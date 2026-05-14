require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();

// เชื่อมต่อ Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- ROUTES สำหรับหน้าเว็บ ---

// 1. หน้าแรกและหน้าแจ้งงาน
app.get('/', (req, res) => {
    res.render('index');
});

// 2. หน้าแอดมิน: ดึงข้อมูลงานจาก Supabase มาแสดง
app.get('/admin', async (req, res) => {
    const { data: jobs, error } = await supabase
        .from('jobs') // ตรวจสอบชื่อตารางใน Supabase ของคุณ
        .select('*')
        .order('created_at', { ascending: false });
    
    res.render('admin', { jobs });
});

// --- API สำหรับฟีเจอร์หลัก ---

// สมาชิกหรือคนทั่วไปแจ้งงาน
app.post('/api/jobs/request', async (req, res) => {
    const { name, phone, detail } = req.body;
    const { error } = await supabase
        .from('jobs')
        .insert([{ customer_name: name, phone, detail, status: 'Pending' }]);

    if (error) return res.status(500).send("เกิดข้อผิดพลาด");
    res.redirect('/?success=true');
});

// แอดมินเสนอราคาไปยังสมาชิก
app.post('/api/admin/quote', async (req, res) => {
    const { jobId, price } = req.body;
    await supabase
        .from('jobs')
        .update({ price: price, status: 'Quoted' })
        .eq('id', jobId);
    
    res.redirect('/admin');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`App running on http://localhost:${PORT}`));
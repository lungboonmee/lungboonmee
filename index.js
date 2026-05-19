const { createClient } = require('@supabase/supabase-js');

// 1. ตั้งค่าการเชื่อมต่อ (เอามาจาก Project Settings > API ใน Supabase ของลุงครับ)
const supabaseUrl = 'https://dajcjokcegueuzuomqns.supabase.co';
const supabaseKey = 'sb_publishable_siafrqSDjwVqsDrT3DMkTA_DQqR2V1Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getJobsWithSteps() {
    console.log('--- กำลังดึงข้อมูลงานและขั้นตอนงานของลุงบุญมี... ---');

    // 2. ดึงข้อมูลจากตาราง jobs พร้อมดึงข้อมูลจาก job_steps ที่เชื่อมกันมาด้วย
    const { data, error } = await supabase
        .from('jobs')
        .select(`
            customer_name,
            detail,
            job_steps (
                step_name,
                is_done
            )
        `);

    if (error) {
        console.error('เกิดข้อผิดพลาด:', error.message);
        return;
    }

    // 3. แสดงผลใน Terminal
    data.forEach(job => {
        console.log(`\n👷 ลูกค้า: ${job.customer_name}`);
        console.log(`📝 รายละเอียด: ${job.detail}`);
        
        if (job.job_steps.length > 0) {
            console.log('📍 ขั้นตอนงาน:');
            job.job_steps.forEach(step => {
                const status = step.is_done ? '✅' : '⏳';
                console.log(`   ${status} ${step.step_name}`);
            });
        } else {
            console.log('📍 ยังไม่มีขั้นตอนงานบันทึกไว้');
        }
        console.log('---------------------------');
    });
}

getJobsWithSteps();
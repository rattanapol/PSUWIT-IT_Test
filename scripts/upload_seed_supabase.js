const fs = require('fs');

async function upload() {
  const key = 'sb_publishable_nN34iose4rGJmLuIogmryQ_EE_pygrv';
  const url = 'https://tutuacgluubwpiomaepv.supabase.co/rest/v1/students?on_conflict=email';
  
  const content = fs.readFileSync('./js/users_data.js', 'utf8');
  const match = content.match(/INITIAL_USERS_STUDENTS\s*=\s*(\[.*?\]);/s);
  if (!match) {
    console.error('Could not find INITIAL_USERS_STUDENTS in js/users_data.js');
    return;
  }
  
  const students = JSON.parse(match[1]);
  console.log(`Total students to upload: ${students.length}`);
  
  const batchSize = 100;
  for (let i = 0; i < students.length; i += batchSize) {
    const chunk = students.slice(i, i + batchSize).map(s => ({
      student_id: String(s.student_id || ''),
      class_no: String(s.class_no || ''),
      title: s.title || '',
      first_name: s.first_name || '',
      last_name: s.last_name || '',
      name: s.name || '',
      email: (s.email || s.username || '').trim().toLowerCase(),
      username: (s.username || s.email || '').trim().toLowerCase(),
      password: String(s.password || '123456'),
      grade: s.grade || 'ม.1',
      room: String(s.room || ''),
      role: 'student',
      status: s.status || 'active',
      pretest_completed: Boolean(s.pretest_completed),
      posttest_completed: Boolean(s.posttest_completed)
    }));
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(chunk)
    });
    
    if (!res.ok) {
      console.error(`Error uploading chunk ${i} - ${i + chunk.length}: ${res.status} ${await res.text()}`);
      return;
    }
    console.log(`Uploaded ${Math.min(i + chunk.length, students.length)} / ${students.length}`);
  }
  
  console.log('Finished uploading all students to Supabase!');
}

upload().catch(console.error);

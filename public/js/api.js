/* ==========================================================
   api.js  -  the ONLY file that talks to the backend.
   Pages call API.something(); they never use fetch directly.
   To switch backend (Firebase / Supabase / PHP) only this file changes.
   ========================================================== */
const API = (() => {
  const BASE = '/api';
  const session = {
    get token() { return sessionStorage.getItem('fbs_token'); },
    get user() { try { return JSON.parse(sessionStorage.getItem('fbs_user')); } catch { return null; } },
    save(token, user) { sessionStorage.setItem('fbs_token', token); sessionStorage.setItem('fbs_user', JSON.stringify(user)); },
    clear() { sessionStorage.removeItem('fbs_token'); sessionStorage.removeItem('fbs_user'); }
  };

  async function request(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (session.token) headers.Authorization = 'Bearer ' + session.token;
    let res;
    try { res = await fetch(BASE + url, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
    catch { throw new Error('Cannot reach the server. Is it running?'); }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && session.token) { session.clear(); location.href = 'login.html?expired=1'; }
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }
  const get = u => request('GET', u), post = (u, b) => request('POST', u, b || {}),
        put = (u, b) => request('PUT', u, b), del = u => request('DELETE', u);
  const qs = o => { const p = new URLSearchParams(); Object.entries(o || {}).forEach(([k, v]) => v && p.set(k, v)); const s = p.toString(); return s ? '?' + s : ''; };

  return {
    session,
    // public
    config: () => get('/public/config'),
    publicClasses: () => get('/public/classes'),
    // auth
    register: d => post('/auth/register', d),
    async login(email, password) { const r = await post('/auth/login', { email, password }); session.save(r.token, r.user); return r.user; },
    async logout() { try { await post('/auth/logout'); } catch {} session.clear(); },
    // academics
    departments: () => get('/departments'),
    addDepartment: name => post('/departments', { name }),
    updateDepartment: (id, name) => put('/departments/' + id, { name }),
    deleteDepartment: id => del('/departments/' + id),
    classes: () => get('/classes'),
    addClass: d => post('/classes', d), updateClass: (id, d) => put('/classes/' + id, d), deleteClass: id => del('/classes/' + id),
    faculties: () => get('/faculties'),
    addFaculty: d => post('/faculties', d), updateFaculty: (id, d) => put('/faculties/' + id, d), deleteFaculty: id => del('/faculties/' + id),
    students: () => get('/students'),
    resetStudentPassword: (id, password) => post(`/students/${id}/reset-password`, { password }),
    deleteStudent: id => del('/students/' + id),
    // questions
    questions: () => get('/questions'),
    addQuestion: d => post('/questions', d), updateQuestion: (id, d) => put('/questions/' + id, d), deleteQuestion: id => del('/questions/' + id),
    // surveys
    surveys: () => get('/surveys'),
    survey: id => get('/surveys/' + id),
    addSurvey: d => post('/surveys', d), updateSurvey: (id, d) => put('/surveys/' + id, d),
    setSurveyActive: (id, isActive) => request('PATCH', `/surveys/${id}/active`, { isActive }),
    deleteSurvey: id => del('/surveys/' + id),
    // student
    mySurveys: () => get('/my/surveys'),
    submitSurvey: (id, answers) => post(`/surveys/${id}/submit`, { answers }),
    // reports
    stats: () => get('/admin/stats'),
    submissionOverview: () => get('/admin/submission-overview'),
    facultyReport: f => get('/reports/faculty' + qs(f)),
    facultyDetail: (id, surveyId) => get(`/reports/faculty/${id}` + qs({ surveyId })),
    submissionStatus: surveyId => get('/reports/submissions/' + surveyId)
  };
})();

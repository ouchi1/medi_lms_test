import { API } from './modules/api.js';

// ប្រកាសអថេរទាំងអស់នៅខាងលើគេបង្អស់
let authMode = 'login';
let activeExam = { subjectId: null, questions: [], answers: {}, currentIndex: 0 };
let skippedQuestions = [];
let currentSchoolFilter = ''; 

// 🔥 Function សម្រាប់បំប្លែង Link YouTube គ្រប់ទម្រង់ទៅជា Embed Link 🔥
function getYouTubeEmbedUrl(url) {
    if (!url) return '';
    if (url.includes('/embed/')) return url;

    let videoId = '';
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1);
        } else if (urlObj.hostname.includes('youtube.com')) {
            videoId = urlObj.searchParams.get('v');
        }
    } catch (e) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        if (match && match[2].length === 11) {
            videoId = match[2];
        }
    }

    if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
    }
    return url;
}

// មុខងារជំនួយសម្រាប់ទាញយកឈ្មោះតម្រៀបតាមថ្នាក់ (Hierarchical Names)
function getFolderPathName(subject, allList) {
    if (!subject || !subject.name) return '';
    let path = [subject.name];
    let current = subject;
    let safetyCounter = 0;
    
    while (current && current.parent_id !== null && current.parent_id !== undefined && safetyCounter < 10) {
        let parent = allList.find(s => s.id === current.parent_id);
        if (parent && parent.name) {
            path.unshift(parent.name);
            current = parent;
        } else {
            break;
        }
        safetyCounter++;
    }
    return path.join(' ➔ ');
}

// មុខងារជំនួយសម្រាប់បម្លែង File ទៅជា Base64
function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();
    initApp();
});

function initApp() {
    renderUserSession();
    setupNavigation();
    setupEvents();
    setupDarkMode(); 
    loadLessons();
    loadQCMSubjects();

    const savedExamState = localStorage.getItem('exam_state');
    if (savedExamState) {
        try {
            const parsedState = JSON.parse(savedExamState);
            activeExam = parsedState;
            skippedQuestions = parsedState.skippedQuestions || [];

            document.getElementById('school-card-view').classList.add('hidden');
            document.getElementById('school-details-view').classList.add('hidden');
            document.getElementById('qcm-exam-view').classList.remove('hidden');
            document.getElementById('qcm-result-view').classList.add('hidden');
            
            renderQuestion();
            
            const navQcmBtn = document.getElementById('nav-qcm');
            if (navQcmBtn) navQcmBtn.click();
            localStorage.setItem('active_tab', 'nav-qcm');
        } catch (error) {
            console.error("Error parsing saved exam state:", error);
            localStorage.removeItem('exam_state'); 
        }
    }
}

// ១. គ្រប់គ្រង Navigation & Tabs
function setupNavigation() {
    const tabs = {
        'nav-home': 'tab-home',
        'nav-lessons': 'tab-lessons',
        'nav-qcm': 'tab-qcm',
        'nav-admin': 'tab-admin',
        'btn-logo': 'tab-home'
    };

    Object.keys(tabs).forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.onclick = () => {
                document.querySelectorAll('.nav-btn').forEach(b => {
                    b.classList.remove('bg-white', 'dark:bg-slate-700', 'text-brand-600', 'dark:text-indigo-400', 'shadow-sm');
                    b.classList.add('text-slate-600', 'dark:text-slate-300');
                });
                if (btnId !== 'btn-logo' && btnId !== 'nav-admin') {
                    btn.classList.add('bg-white', 'dark:bg-slate-700', 'text-brand-600', 'dark:text-indigo-400', 'shadow-sm');
                    btn.classList.remove('text-slate-600', 'dark:text-slate-300');
                }

                document.querySelectorAll('.tab-content').forEach(sec => sec.classList.add('hidden'));
                document.getElementById(tabs[btnId]).classList.remove('hidden');

                localStorage.setItem('active_tab', btnId);

                if (btnId === 'nav-qcm' || btnId === 'nav-admin') {
                    if (btnId === 'nav-qcm') {
                        if (!localStorage.getItem('exam_state')) {
                            document.getElementById('school-card-view').classList.remove('hidden');
                            document.getElementById('school-details-view').classList.add('hidden');
                            document.getElementById('qcm-exam-view').classList.add('hidden');
                            document.getElementById('qcm-result-view').classList.add('hidden');
                        }
                    }
                    loadQCMSubjects();
                } else if (btnId === 'nav-lessons') {
                    loadLessons();
                }
            };
        }
    });

    const savedTab = localStorage.getItem('active_tab');
    if (savedTab && document.getElementById(savedTab)) {
        document.getElementById(savedTab).click();
    }
}

// ២. Render User Session
function renderUserSession() {
    const userStr = localStorage.getItem('medi_user');
    const guestView = document.getElementById('auth-guest-view');
    const userView = document.getElementById('auth-user-view');
    const adminBtn = document.getElementById('nav-admin');

    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            if (guestView) guestView.classList.add('hidden');
            if (userView) userView.classList.remove('hidden');
            
            if (document.getElementById('user-display-name')) {
                document.getElementById('user-display-name').innerText = user.name || user.email || 'User';
            }
            
            const rawRole = user.role ? String(user.role).toUpperCase().trim() : '';
            if (document.getElementById('user-role-badge')) {
                document.getElementById('user-role-badge').innerText = rawRole || 'GUEST';
            }

            if (rawRole === 'ADMIN' || rawRole === 'TEACHER' || rawRole === 'SUPERADMIN') {
                if (adminBtn) adminBtn.classList.remove('hidden');
                document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
            } else {
                if (adminBtn) adminBtn.classList.add('hidden');
                document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
            }
        } catch (e) {
            console.error("Error parsing user session:", e);
            localStorage.removeItem('medi_user');
            resetGuestUI(guestView, userView, adminBtn);
        }
    } else {
        resetGuestUI(guestView, userView, adminBtn);
    }
}

function resetGuestUI(guestView, userView, adminBtn) {
    if (guestView) guestView.classList.remove('hidden');
    if (userView) userView.classList.add('hidden');
    if (adminBtn) adminBtn.classList.add('hidden');
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
}

// ៣. ទាញយកមេរៀនវីដេអូ
async function loadLessons() {
    const foldersGrid = document.getElementById('lesson-folders-grid');
    const videosView = document.getElementById('lesson-videos-view');
    const videosGrid = document.getElementById('lessons-grid');
    const currentFolderTitle = document.getElementById('current-folder-title');
    const btnBackToFolders = document.getElementById('btn-back-to-folders');
    const lessonSelectSubject = document.getElementById('lesson-select-subject');

    if (!foldersGrid) return;

    const user = JSON.parse(localStorage.getItem('medi_user'));
    const token = localStorage.getItem('token');

    if (!token || !user) {
        foldersGrid.innerHTML = `
            <div class="col-span-3 text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <div class="text-4xl mb-3">🔒</div>
                <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-1">សូមចូលប្រព័ន្ធជាមុនសិន</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">អ្នកត្រូវតែ Login ចូលគណនីទើបអាចមើលមេរៀនវីដេអូបាន។</p>
                <button type="button" onclick="document.getElementById('btn-open-login').click();" class="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition">
                    ចូលប្រព័ន្ធ (Login)
                </button>
            </div>
        `;
        if (videosView) videosView.classList.add('hidden');
        return;
    }

    try {
        const subjects = await API.request('/subjects'); 
        const lessons = await API.getLessons();

        if (!subjects || !Array.isArray(subjects) || !lessons) return;

        if (lessonSelectSubject) {
            const videoSubjects = subjects.filter(s => s.type === 'video');
            lessonSelectSubject.innerHTML = `<option value="">-- ជ្រើសរើសមុខវិជ្ជាវីដេអូ --</option>` + videoSubjects.map(sub => {
                return `<option value="${sub.id}">${sub.name} (ID: ${sub.id})</option>`;
            }).join('');
        }

        const videoFolders = subjects.filter(s => s.parent_id === null && s.type === 'video');
        const videoChildSubjects = subjects.filter(s => s.parent_id !== null && s.type === 'video');

        if (!videoFolders.length) {
            foldersGrid.innerHTML = `<div class="col-span-3 text-center py-10 text-slate-400">មិនទាន់មាន Folder មេសម្រាប់វីដេអូនៅឡើយទេ</div>`;
            return;
        }

        const isAdmin = user && (String(user.role).toUpperCase() === 'ADMIN' || String(user.role).toUpperCase() === 'TEACHER');

        foldersGrid.innerHTML = videoFolders.map(folder => {
            const childrenIds = videoChildSubjects.filter(s => s.parent_id === folder.id).map(s => s.id);
            const allIds = [folder.id, ...childrenIds];
            const lessonCount = lessons.filter(l => allIds.includes(l.subject_id)).length;

            return `
                <div class="folder-card bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm hover:shadow-md transition relative flex flex-col items-center text-center" data-folder-id="${folder.id}" data-folder-name="${folder.name}">
                    ${isAdmin ? `
                        <div class="absolute top-3 right-3 flex items-center gap-1 z-10">
                            <button type="button" data-id="${folder.id}" data-name="${folder.name}" class="btn-edit-video-folder p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition" title="កែប្រែឈ្មោះ">✏️</button>
                            <button type="button" data-id="${folder.id}" class="btn-delete-video-folder p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition" title="លុប Folder">🗑️</button>
                        </div>
                    ` : ''}
                    <div class="folder-content-click cursor-pointer w-full flex flex-col items-center">
                        <div class="w-16 h-16 rounded-xl bg-amber-50 dark:bg-slate-700 text-amber-600 flex items-center justify-center font-bold text-3xl mb-4">📁</div>
                        <h3 class="font-bold text-slate-900 dark:text-white text-lg mb-1">${folder.name}</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400">${lessonCount} វីដេអូ</p>
                    </div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.folder-content-click').forEach((item, idx) => {
            item.onclick = () => {
                const card = document.querySelectorAll('.folder-card')[idx];
                const folderId = parseInt(card.dataset.folderId);
                const folderName = card.dataset.folderName;

                foldersGrid.classList.add('hidden');
                videosView.classList.remove('hidden');
                currentFolderTitle.innerText = folderName;

                const openAddLessonBtn = document.getElementById('btn-open-add-lesson-modal');
                if (openAddLessonBtn) {
                    openAddLessonBtn.dataset.currentFolderId = folderId;
                }

                const childrenIds = videoChildSubjects.filter(s => s.parent_id === folderId).map(s => s.id);
                const allIds = [folderId, ...childrenIds];
                const folderLessons = lessons.filter(l => allIds.includes(l.subject_id));

                if (!folderLessons.length) {
                    videosGrid.innerHTML = `<div class="col-span-3 text-center py-10 text-slate-400">មិនទាន់មានវីដេអូនៅក្នុង Folder នេះទេ</div>`;
                    return;
                }

                videosGrid.innerHTML = folderLessons.map(les => `
                    <div class="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition relative flex flex-col justify-between">
                        <div>
                            <div class="aspect-video bg-slate-900 rounded-xl overflow-hidden mb-3">
                                <iframe src="${getYouTubeEmbedUrl(les.video_url)}" class="w-full h-full" frameborder="0" allowfullscreen></iframe>
                            </div>
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-xs font-bold text-brand-600 uppercase tracking-wider">${les.subject_name || 'វីដេអូមេរៀន'}</span>
                                ${isAdmin ? `
                                    <div class="flex items-center gap-1">
                                        <button type="button" data-id="${les.id}" data-title="${les.title}" data-url="${les.video_url}" data-subject="${les.subject_id}" class="btn-edit-lesson text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg font-bold transition">✏️ កែ</button>
                                        <button type="button" data-id="${les.id}" class="btn-delete-lesson text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg font-bold transition">🗑️ លុប</button>
                                    </div>
                                ` : ''}
                            </div>
                            <h4 class="font-bold text-slate-900 dark:text-white text-sm sm:text-base">${les.title}</h4>
                        </div>
                    </div>
                `).join('');

                document.querySelectorAll('.btn-delete-lesson').forEach(btn => {
                    btn.onclick = async () => {
                        if (confirm('តើអ្នកពិតជាចង់លុបមេរៀនវីដេអូនេះចេញមែនទេ?')) {
                            try {
                                const res = await API.deleteLesson(btn.dataset.id);
                                alert(res.message);
                                loadLessons();
                            } catch (err) { alert(err.message); }
                        }
                    };
                });
            };
        });

        document.querySelectorAll('.btn-edit-video-folder').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const oldName = btn.dataset.name;
                const newName = prompt('សូមបញ្ចូលឈ្មោះ Folder វីដេអូថ្មី:', oldName);
                if (newName && newName.trim() !== "" && newName !== oldName) {
                    try {
                        const res = await API.updateSubject(id, newName.trim(), null);
                        alert(res.message || 'កែប្រែ Folder ជោគជ័យ!');
                        loadLessons();
                        loadQCMSubjects();
                    } catch (err) {
                        alert('មានបញ្ហា: ' + err.message);
                    }
                }
            };
        });

        document.querySelectorAll('.btn-delete-video-folder').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                if (confirm('តើអ្នកពិតជាចង់លុប Folder នេះមែនទេ?')) {
                    try {
                        const res = await API.deleteSubject(btn.dataset.id);
                        alert(res.message || 'លុប Folder បានជោគជ័យ!');
                        loadLessons();
                        loadQCMSubjects();
                    } catch (err) {
                        alert('មានបញ្ហា: ' + err.message);
                    }
                }
            };
        });

        if (btnBackToFolders) {
            btnBackToFolders.onclick = () => {
                videosView.classList.add('hidden');
                foldersGrid.classList.remove('hidden');
            };
        }

        const openAddLessonBtn = document.getElementById('btn-open-add-lesson-modal');
        if (openAddLessonBtn) {
            openAddLessonBtn.onclick = () => {
                const currentFolderId = openAddLessonBtn.dataset.currentFolderId;
                if (!currentFolderId) return alert('សូមជ្រើសរើស Folder ជាមុនសិន!');

                // 🟢 រក្សាទុក Folder ID ទុកប្រើប្រាស់ពេល Submit
                window.activeVideoFolderId = currentFolderId;

                const subjectIdInput = document.getElementById('inline-lesson-subject-id');
                if (subjectIdInput) {
                    subjectIdInput.value = currentFolderId;
                }

                document.getElementById('inline-add-lesson-modal').classList.remove('hidden');
            };
        }
    } catch (e) { 
        console.error('Error loading lessons:', e.message); 
    }
}

// ៤. ទាញយកមុខវិជ្ជា QCM និងសាលា
async function loadQCMSubjects() {
    const grid = document.getElementById('qcm-subjects-grid');
    const yearSelect = document.getElementById('year-filter-select');
    const schoolCard = document.getElementById('school-card-view');
    const schoolDetails = document.getElementById('school-details-view');
    const btnBackSchool = document.getElementById('btn-back-to-school');
    
    const currentSchoolLogo = document.getElementById('current-school-logo');
    const currentSchoolName = document.getElementById('current-school-name');

    try {
        const subjects = await API.getQCMSubjects();
        let schools = [];
        
        try {
            schools = await API.getSchools();
            if (!Array.isArray(schools) || schools.length === 0) throw new Error("No schools");
        } catch (schoolError) {
            schools = [
                { id: 1, name: 'សាលារៀនវេជ្ជសាស្ត្រ', logo_type: 'emoji', logo_url: '🏥', description: 'Medical School' },
                { id: 2, name: 'សាលារៀនគិលានុបដ្ឋាយិកា', logo_type: 'emoji', logo_url: '💉', description: 'Nursing School' },
                { id: 3, name: 'សាលារៀនទន្តសាស្ត្រ', logo_type: 'emoji', logo_url: '🦷', description: 'Dentistry School' }
            ];
        }

        renderAdminSchoolsList(schools);

        if (!subjects || !Array.isArray(subjects)) return;

        const getParentId = (s) => {
            let pid = s.parent_id !== undefined ? s.parent_id : (s.parentId !== undefined ? s.parentId : s.parent);
            if (pid === undefined || pid === null || String(pid).trim().toLowerCase() === 'null' || String(pid).trim() === '0' || String(pid).trim() === '') {
                return null;
            }
            return parseInt(pid, 10);
        };

        if (yearSelect) {
            let yearOptions = `<option value="all">-- បង្ហាញទាំងអស់ --</option>`;
            for (let y = 1; y <= 8; y++) {
                for (let s = 1; s <= 2; s++) {
                    yearOptions += `<option value="Y${y}S${s}">Y${y}S${s}</option>`;
                }
            }
            yearSelect.innerHTML = yearOptions;
        }

        const schoolGrid = schoolCard.querySelector('.grid');
        schoolGrid.innerHTML = schools.map(school => {
            let cleanLogo = school.logo_url;
            
            if (!cleanLogo || typeof cleanLogo !== 'string' || cleanLogo.includes('object') || cleanLogo.trim() === '') {
                cleanLogo = '🏫';
            }

            // 🟢 បន្ថែមលក្ខខណ្ឌពិនិត្យមើល data:image (Base64) និង URL ឱ្យបានច្បាស់លាស់
            let logoHtml = (cleanLogo.startsWith('http') || cleanLogo.startsWith('data:image')) ? 
                `<img src="${cleanLogo}" alt="logo" class="w-20 h-20 object-contain rounded-2xl mb-4 bg-white p-1 border border-slate-200 shadow-sm" onerror="this.outerHTML='<div class=\'text-4xl mb-4\'>🏫</div>'">` : 
                `<div class="text-4xl mb-4">${cleanLogo}</div>`;

            return `
                <div class="school-select-card bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition cursor-pointer flex flex-col items-center text-center group" data-school-id="${school.id}" data-school-name="${school.name}">
                    ${logoHtml}
                    <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-1">${school.name}</h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400">${school.description || ''}</p>
                </div>
            `;
        }).join('');

        const schoolIdSelect = document.getElementById('new-folder-school-id');
        if (schoolIdSelect) {
            schoolIdSelect.innerHTML = `<option value="">-- ជ្រើសរើសសាលា --</option>` + schools.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }

        const qcmOnlySubjects = subjects.filter(s => s.type === 'qcm');

        const qcmParentOptions = qcmOnlySubjects.map(s => {
            const fullNamePath = getFolderPathName(s, qcmOnlySubjects);
            return `<option value="${s.id}">${fullNamePath} (ID: ${s.id})</option>`;
        }).join('');

        const parentIdSelect = document.getElementById('new-folder-parent-id');
        if (parentIdSelect) {
            parentIdSelect.innerHTML = `<option value="">-- ជា Folder មេ (No Parent) --</option>` + qcmParentOptions;
        }

        const subjectParentSelect = document.getElementById('subject-parent-select');
        if (subjectParentSelect) {
            subjectParentSelect.innerHTML = `<option value="">-- ជាមុខវិជ្ជាមេទូទៅ (No Parent) --</option>` + qcmParentOptions;
        }

        document.querySelectorAll('.school-select-card').forEach(card => {
            card.onclick = () => {
                const schoolId = parseInt(card.dataset.schoolId);
                const schoolName = card.dataset.schoolName;
                currentSchoolFilter = schoolName;

                const schoolData = schools.find(s => s.id === schoolId);
                let cleanLogo = schoolData.logo_url || '🏫';
                if (cleanLogo.startsWith('http') || cleanLogo.startsWith('data:image')) {
                    currentSchoolLogo.innerHTML = `<img src="${cleanLogo}" class="w-10 h-10 object-contain rounded-lg">`;
                    currentSchoolLogo.className = 'w-10 h-10';
                } else {
                    currentSchoolLogo.innerHTML = cleanLogo;
                    currentSchoolLogo.className = 'w-10 h-10 flex items-center justify-center text-xl';
                }
                currentSchoolName.innerText = schoolName;

                schoolCard.classList.add('hidden');
                schoolDetails.classList.remove('hidden');
                
                const currentYear = yearSelect ? yearSelect.value : 'all';
                renderSubjectGrid(subjects, schoolId, currentYear, getParentId);
            };
        });

        if (btnBackSchool) {
            btnBackSchool.onclick = () => {
                schoolDetails.classList.add('hidden');
                schoolCard.classList.remove('hidden');
                currentSchoolFilter = ''; 
            };
        }

        if (yearSelect) {
            yearSelect.onchange = (e) => {
                const selectedYear = e.target.value;
                const activeCard = document.querySelector('.school-select-card');
                const schoolId = activeCard ? parseInt(activeCard.dataset.schoolId) : 1;
                renderSubjectGrid(subjects, schoolId, selectedYear, getParentId);
            };
        }

        if (subjects.length > 0) {
            const qcmOnlyOptions = qcmOnlySubjects.map(s => {
                const hasParent = getParentId(s) !== null;
                return `<option value="${s.id}">${hasParent ? `↳ ` : ''}${s.name} (ID: ${s.id})</option>`;
            }).join('');
            
            const adminSelect = document.getElementById('qcm-select-subject');
            const adminFilterSelect = document.getElementById('admin-filter-subject');
            const excelImportSelect = document.getElementById('excel-import-subject-id');

            if (adminSelect) adminSelect.innerHTML = qcmOnlyOptions;
            if (excelImportSelect) excelImportSelect.innerHTML = `<option value="">-- ជ្រើសរើសមុខវិជ្ជា --</option>` + qcmOnlyOptions;

            if (adminFilterSelect) {
                adminFilterSelect.innerHTML = qcmOnlyOptions;
                const childSubs = qcmOnlySubjects.filter(s => getParentId(s) !== null);
                const defaultSubId = childSubs.length > 0 ? childSubs[0].id : (qcmOnlySubjects[0] ? qcmOnlySubjects[0].id : '');
                if (defaultSubId) loadAdminQuestions(defaultSubId);
            }

            renderAdminSubjectsList(qcmOnlySubjects, getParentId);
        }
    } catch (e) { 
        console.error('Error loading subjects:', e.message); 
    }
}

// ៥. Function Render Subject Grid
function renderSubjectGrid(allSubjects, schoolId, yearFilter, getParentId) {
    const grid = document.getElementById('qcm-subjects-grid');
    if (!grid) return;

    let filteredSubjects = allSubjects.filter(s => s.type === 'qcm');

    if (schoolId) {
        filteredSubjects = filteredSubjects.filter(s => {
            if (getParentId(s) === null) {
                return parseInt(s.school_id) === parseInt(schoolId);
            }
            return true; 
        });
    }

    const rootFolders = filteredSubjects.filter(s => getParentId(s) === null);

    if (!rootFolders.length && !filteredSubjects.length) {
        grid.innerHTML = `<div class="col-span-3 text-center py-10 text-slate-400">មិនមាន Folder ឬមុខវិជ្ជាទេ</div>`;
        return;
    }

    let htmlContent = '';

    rootFolders.forEach((rootFolder) => {
        const level1Children = allSubjects.filter(s => getParentId(s) === parseInt(rootFolder.id) && s.type === 'qcm');

        htmlContent += `
            <div class="col-span-1 md:col-span-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm mb-4">
                <div id="folder-btn-${rootFolder.id}" class="flex items-center justify-between cursor-pointer select-none">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-xl bg-amber-50 dark:bg-slate-700 text-amber-600 flex items-center justify-center font-bold text-2xl">📁</div>
                        <div>
                            <h3 class="font-bold text-slate-900 dark:text-white text-xl">${rootFolder.name}</h3>
                            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">ចុចទីនេះដើម្បីបង្ហាញ/លាក់ថ្នាក់រៀនខាងក្នុង</p>
                        </div>
                    </div>
                    <span id="folder-arrow-${rootFolder.id}" class="text-xl font-bold text-slate-400 transition-transform">▼</span>
                </div>
                
                <div id="folder-container-${rootFolder.id}" class="hidden pt-4 mt-4 border-t border-slate-100 dark:border-slate-700 space-y-4">
        `;

        if (level1Children.length > 0) {
            level1Children.forEach(l1Child => {
                const level2Children = allSubjects.filter(s => getParentId(s) === parseInt(l1Child.id) && s.type === 'qcm');

                if (level2Children.length > 0) {
                    htmlContent += `
                        <div class="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                            <div id="subfolder-btn-${l1Child.id}" class="flex items-center justify-between cursor-pointer select-none">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-lg bg-amber-100 dark:bg-slate-800 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-xl">📁</div>
                                    <div>
                                        <h4 class="font-bold text-slate-900 dark:text-white text-base">${l1Child.name}</h4>
                                        <p class="text-[11px] text-slate-500 dark:text-slate-400">មាន ${level2Children.length} មុខវិជ្ជា/តេស្តខាងក្នុង</p>
                                    </div>
                                </div>
                                <span id="subfolder-arrow-${l1Child.id}" class="text-sm font-bold text-slate-400 transition-transform">▼</span>
                            </div>
                            
                            <div id="subfolder-container-${l1Child.id}" class="hidden space-y-3 pt-3 mt-3 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                ${level2Children.map(l2Child => `
                                    <div data-id="${l2Child.id}" class="subject-card bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:border-brand-500 transition cursor-pointer flex items-center justify-between">
                                        <div class="flex items-center gap-2.5">
                                            <div class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-slate-700 text-brand-600 flex items-center justify-center font-bold text-xs">📄</div>
                                            <div>
                                                <h5 class="font-bold text-slate-900 dark:text-white text-xs">${l2Child.name}</h5>
                                                <p class="text-[10px] text-slate-500 dark:text-slate-400">${l2Child.question_count || 0} សំណួរ</p>
                                            </div>
                                        </div>
                                        <span class="text-xs font-bold text-brand-600">ធ្វើតេស្ត →</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                } else {
                    htmlContent += `
                        <div data-id="${l1Child.id}" class="subject-card bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:border-brand-500 transition cursor-pointer flex items-center justify-between">
                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-slate-800 text-brand-600 flex items-center justify-center font-bold text-sm">📄</div>
                                <div>
                                    <h4 class="font-bold text-slate-900 dark:text-white text-sm mb-1">${l1Child.name}</h4>
                                    <p class="text-[11px] text-slate-500 dark:text-slate-400">${l1Child.question_count || 0} សំណួរ</p>
                                </div>
                            </div>
                            <span class="text-xs font-bold text-brand-600">ចាប់ផ្តើមធ្វើតេស្ត →</span>
                        </div>
                    `;
                }
            });
        } else {
            htmlContent += `<div class="text-sm text-slate-400 py-2">មិនទាន់មានទិន្នន័យនៅខាងក្នុងទេ</div>`;
        }

        htmlContent += `
                </div>
            </div>
        `;
    });

    grid.innerHTML = htmlContent;

    rootFolders.forEach(folder => {
        const folderBtn = document.getElementById(`folder-btn-${folder.id}`);
        const subContainer = document.getElementById(`folder-container-${folder.id}`);
        const arrow = document.getElementById(`folder-arrow-${folder.id}`);

        if (folderBtn && subContainer && arrow) {
            folderBtn.onclick = () => {
                subContainer.classList.toggle('hidden');
                arrow.classList.toggle('rotate-180');
            };
        }

        const level1Children = allSubjects.filter(s => getParentId(s) === parseInt(folder.id) && s.type === 'qcm');
        level1Children.forEach(l1Child => {
            const subBtn = document.getElementById(`subfolder-btn-${l1Child.id}`);
            const subCont = document.getElementById(`subfolder-container-${l1Child.id}`);
            const subArrow = document.getElementById(`subfolder-arrow-${l1Child.id}`);

            if (subBtn && subCont && subArrow) {
                subBtn.onclick = (e) => {
                    e.stopPropagation();
                    subCont.classList.toggle('hidden');
                    subArrow.classList.toggle('rotate-180');
                };
            }
        });
    });

    document.querySelectorAll('.subject-card').forEach(card => {
        card.onclick = (e) => {
            e.stopPropagation();
            const id = parseInt(card.dataset.id);
            if (id) startExam(id);
        };
    });
}

// ៦. ទាញយកសំណួរមកបង្ហាញក្នុង Admin Panel
async function loadAdminQuestions(subjectId) {
    // 🟢 ស្វែងរក Container តាម ID ផ្សេងៗគ្នាដើម្បីធានាថាមិនខុស
    const container = document.getElementById('admin-questions-container') || 
                      document.getElementById('admin-questions-list') || 
                      document.querySelector('[id*="question"]');
    
    if (!container) {
        console.warn('រកមិនឃើញ Container សម្រាប់បង្ហាញបញ្ជីសំណួរទេ!');
        return;
    }

    if (!subjectId) {
        const selectSubject = document.getElementById('admin-filter-subject');
        subjectId = selectSubject ? selectSubject.value : null;
    }

    if (!subjectId) {
        container.innerHTML = `<div class="text-center py-6 text-slate-400">សូមជ្រើសរើសមុខវិជ្ជាជាមុនសិន</div>`;
        return;
    }

    try {
        container.innerHTML = `<div class="text-center py-6 text-slate-400">កំពុងទាញយកទិន្នន័យ...</div>`;
        
        // ហៅ API ទាញយកសំណួរតាម Subject ID[cite: 7]
        const questions = await API.request(`/qcm/questions/${subjectId}`);

        if (!questions || questions.length === 0) {
            container.innerHTML = `<div class="text-center py-6 text-slate-400">រកមិនឃើញសំណួរសម្រាប់មុខវិជ្ជានេះទេ</div>`;
            return;
        }

        // Render បញ្ជីសំណួរ ព្រមទាំង Checkbox និងប៊ូតុងលុប
        container.innerHTML = `
            <div class="flex items-center justify-between mb-4 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border dark:border-slate-700">
                <div class="flex items-center gap-2">
                    <input type="checkbox" id="select-all-questions" class="w-4 h-4 rounded text-brand-600 focus:ring-brand-500">
                    <label for="select-all-questions" class="text-sm font-bold text-slate-700 dark:text-slate-300">ជ្រើសរើសទាំងអស់ (${questions.length})</label>
                </div>
                <button type="button" id="btn-bulk-delete-qcm" class="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5">
                    🗑️ លុបសំណួរដែលបានជ្រើសរើស
                </button>
            </div>
            <div class="space-y-3">
                ${questions.map((q, idx) => `
                    <div class="flex items-start gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm">
                        <input type="checkbox" value="${q.id}" class="qcm-checkbox mt-1 w-4 h-4 rounded text-brand-600 focus:ring-brand-500">
                        <div class="flex-1">
                            <p class="font-bold text-sm text-slate-900 dark:text-white mb-1">${idx + 1}. ${q.question_text}</p>
                            <span class="text-xs text-slate-500 dark:text-slate-400">ID: ${q.id} | ${q.options ? q.options.length : 0} ជម្រើសចម្លើយ</span>
                        </div>
                        <button type="button" data-id="${q.id}" class="btn-delete-single-qcm px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg text-xs font-bold transition">
                            លុប
                        </button>
                    </div>
                `).join('')}
            </div>
        `;

        // 🟢 ចាប់ Event "ជ្រើសរើសទាំងអស់"
        const selectAllCb = document.getElementById('select-all-questions');
        if (selectAllCb) {
            selectAllCb.onchange = (e) => {
                document.querySelectorAll('.qcm-checkbox').forEach(cb => cb.checked = e.target.checked);
            };
        }

        // 🟢 ចាប់ Event លុបម្តងច្រើន (Bulk Delete)
        const bulkDeleteBtn = document.getElementById('btn-bulk-delete-qcm');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.onclick = async () => {
                const selected = document.querySelectorAll('.qcm-checkbox:checked');
                const ids = Array.from(selected).map(cb => parseInt(cb.value));

                if (ids.length === 0) return alert('សូមធីកជ្រើសរើសសំណួរយ៉ាងហោចណាស់មួយសម្រាប់លុប!');
                if (!confirm(`តើអ្នកពិតជាចង់លុបសំណួរចំនួន ${ids.length} នេះមែនទេ?`)) return;

                try {
                    const res = await API.request('/qcm/questions/bulk-delete', {
                        method: 'POST',
                        body: JSON.stringify({ ids })
                    });
                    alert(res.message || 'លុបសំណួរបានជោគជ័យ!');
                    loadAdminQuestions(subjectId);
                } catch (err) {
                    alert('មានបញ្ហា: ' + err.message);
                }
            };
        }

        // 🟢 ចាប់ Event លុបម្តងមួយ (Single Delete)
        document.querySelectorAll('.btn-delete-single-qcm').forEach(btn => {
            btn.onclick = async () => {
                if (!confirm('តើអ្នកពិតជាចង់លុបសំណួរនេះមែនទេ?ជី')) return;
                try {
                    const res = await API.request(`/qcm/questions/${btn.dataset.id}`, { method: 'DELETE' });
                    alert(res.message || 'លុបសំណួរបានជោគជ័យ!');
                    loadAdminQuestions(subjectId);
                } catch (err) {
                    alert('មានបញ្ហា: ' + err.message);
                }
            };
        });

    } catch (err) {
        container.innerHTML = `<div class="text-center py-6 text-red-500">មិនអាចទាញយកទិន្នន័យសំណួរបានទេ: ${err.message}</div>`;
    }
}

// 🟢 ភ្ជាប់ Event ពេលប្តូរ Dropdown មុខវិជ្ជាក្នុង Admin Panel
const adminFilterSubject = document.getElementById('admin-filter-subject');
if (adminFilterSubject) {
    adminFilterSubject.onchange = (e) => {
        loadAdminQuestions(e.target.value);
    };
    // ហៅទាញយកទិន្នន័យស្រាប់ពេល Load លើកដំបូងប្រសិនបើមាន Value ស្រាប់
    if (adminFilterSubject.value) {
        loadAdminQuestions(adminFilterSubject.value);
    }
}

function renderAdminSchoolsList(schools) {
    const container = document.getElementById('admin-schools-list');
    if (!container) return;

    container.innerHTML = schools.map(school => {
        let cleanLogo = school.logo_url;
        if (!cleanLogo || typeof cleanLogo !== 'string' || cleanLogo.includes('object')) {
            cleanLogo = '🏫';
        }

        // 🟢 គាំទ្រការបង្ហាញ Base64 (data:image) និង URL ក្នុង Admin Panel
        let logoHtml = (cleanLogo.startsWith('http') || cleanLogo.startsWith('data:image'))
            ? `<img src="${cleanLogo}" class="w-10 h-10 object-contain rounded-lg bg-white p-0.5 border" onerror="this.outerHTML='<span class=\'text-2xl\'>🏫</span>'">` 
            : `<span class="text-2xl">${cleanLogo}</span>`;

        return `
            <div class="flex items-center justify-between p-3.5 border dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm mb-2">
                <div class="flex items-center gap-3">
                    ${logoHtml}
                    <div>
                        <p class="font-bold text-sm text-slate-900 dark:text-white">${school.name}</p>
                        <span class="text-xs text-slate-500 dark:text-slate-400">${school.description || ''}</span>
                    </div>
                </div>
                
                <div class="flex items-center gap-2">
                    <button type="button" data-id="${school.id}" data-name="${school.name}" data-logo="${typeof school.logo_url === 'string' ? school.logo_url : ''}" data-logotype="${school.logo_type || 'emoji'}" data-desc="${school.description || ''}" class="btn-edit-school px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition">
                        ✏️ កែឈ្មោះ និងរូប
                    </button>
                    <button type="button" data-id="${school.id}" class="btn-delete-school px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg text-xs font-bold transition">
                        🗑️ លុប
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // ចាប់ Event ប៊ូតុងកែប្រែសាលាឡើងវិញ
    document.querySelectorAll('.btn-edit-school').forEach(btn => {
        btn.onclick = () => {
            const id = btn.dataset.id;
            const name = btn.dataset.name;
            const logoType = btn.dataset.logotype || 'emoji';
            const desc = btn.dataset.desc;

            document.getElementById('edit-school-id').value = id;
            document.getElementById('edit-school-name').value = name;
            document.getElementById('edit-school-desc').value = desc;

            const radio = document.querySelector(`input[name="edit_logo_type"][value="${logoType}"]`);
            if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change'));
            }

            document.getElementById('edit-school-modal')?.classList.remove('hidden');
        };
    });
}

function renderAdminSubjectsList(subjects, getParentId) {
    const adminSubjectsList = document.getElementById('admin-subjects-list');
    if (!adminSubjectsList) return;
    
    let adminListHtml = '';
    const parentFolders = subjects.filter(s => getParentId(s) === null);

    parentFolders.forEach(folder => {
        const level1Children = subjects.filter(s => getParentId(s) === parseInt(folder.id));

        adminListHtml += `
            <div class="mb-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                <div id="admin-folder-toggle-${folder.id}" class="flex items-center justify-between cursor-pointer select-none">
                    <div class="flex items-center gap-3">
                        <span id="admin-arrow-${folder.id}" class="text-sm font-bold text-slate-500 transition-transform">▼</span>
                        <div>
                            <p class="font-bold text-sm text-slate-900 dark:text-white">📁 ${folder.name} (ID: ${folder.id})</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <button type="button" data-id="${folder.id}" data-name="${folder.name}" data-parent="" class="btn-edit-subject px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition">✏️ កែ</button>
                        <button type="button" data-id="${folder.id}" class="btn-delete-subject px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg text-xs font-bold transition">🗑️ លុប</button>
                    </div>
                </div>
                
                <div id="admin-folder-container-${folder.id}" class="hidden pt-3 mt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
        `;

        if (level1Children.length > 0) {
            level1Children.forEach(l1 => {
                const level2Children = subjects.filter(s => getParentId(s) === parseInt(l1.id));
                
                adminListHtml += `
                    <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 ml-4">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span>📁</span>
                                <span class="font-semibold text-xs text-slate-800 dark:text-slate-200">${l1.name} (ID: ${l1.id})</span>
                            </div>
                            <div class="flex items-center gap-1">
                                <button type="button" data-id="${l1.id}" data-name="${l1.name}" data-parent="${folder.id}" class="btn-edit-subject px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded text-[11px] font-bold transition">✏️</button>
                                <button type="button" data-id="${l1.id}" class="btn-delete-subject px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded text-[11px] font-bold transition">🗑️</button>
                            </div>
                        </div>
                `;

                if (level2Children.length > 0) {
                    adminListHtml += `<div class="pl-6 mt-2 space-y-1.5 border-t border-slate-200 dark:border-slate-700 pt-2">`;
                    level2Children.forEach(l2 => {
                        adminListHtml += `
                            <div class="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                                <div class="flex items-center gap-2">
                                    <span class="text-xs">📄</span>
                                    <span class="text-xs text-slate-700 dark:text-slate-300 font-medium">${l2.name} (ID: ${l2.id}) - ${l2.question_count || 0} សំណួរ</span>
                                </div>
                                <div class="flex items-center gap-1">
                                    <button type="button" data-id="${l2.id}" data-name="${l2.name}" data-parent="${l1.id}" class="btn-edit-subject px-2 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded text-[10px] font-bold transition">✏️</button>
                                    <button type="button" data-id="${l2.id}" class="btn-delete-subject px-2 py-0.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded text-[10px] font-bold transition">🗑️</button>
                                </div>
                            </div>
                        `;
                    });
                    adminListHtml += `</div>`;
                }

                adminListHtml += `</div>`;
            });
        }

        adminListHtml += `</div></div>`;
    });

    adminSubjectsList.innerHTML = adminListHtml || `<p class="text-sm text-slate-400 text-center py-4">មិនទាន់មានទិន្នន័យទេ</p>`;

    parentFolders.forEach(folder => {
        const toggleBtn = document.getElementById(`admin-folder-toggle-${folder.id}`);
        const container = document.getElementById(`admin-folder-container-${folder.id}`);
        const arrow = document.getElementById(`admin-arrow-${folder.id}`);

        if (toggleBtn && container && arrow) {
            toggleBtn.onclick = () => {
                container.classList.toggle('hidden');
                arrow.classList.toggle('rotate-180');
            };
        }
    });

    document.querySelectorAll('.btn-delete-subject').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm('តើអ្នកពិតជាចង់លុបមុខវិជ្ជានេះចេញមែនទេ?')) {
                try {
                    const res = await API.deleteSubject(btn.dataset.id);
                    alert(res.message);
                    loadQCMSubjects();
                    loadLessons();
                } catch (err) { alert(err.message); }
            }
        };
    });
}

// ៧. ទាញយកសំណួរ QCM (Exam)
async function startExam(subjectId) {
    const user = JSON.parse(localStorage.getItem('medi_user'));
    const token = localStorage.getItem('token');

    if (!token || !user) {
        alert('សូមចូលប្រព័ន្ធ (Login) ជាមុនសិន ទើបអាចធ្វើតេស្ត QCM បាន!');
        document.getElementById('btn-open-login').click();
        return;
    }

    try {
        const questions = await API.getQCMQuestions(subjectId);
        if (!questions || !questions.length) {
            return alert('មុខវិជ្ជានេះមិនទាន់មានសំណួរនៅឡើយទេ!');
        }

        activeExam = { subjectId, questions, answers: {}, currentIndex: 0 };
        skippedQuestions = []; 

        localStorage.setItem('exam_state', JSON.stringify({
            subjectId: subjectId,
            questions: questions,
            answers: {},
            currentIndex: 0,
            skippedQuestions: []
        }));

        document.getElementById('school-card-view').classList.add('hidden');
        document.getElementById('school-details-view').classList.add('hidden');
        document.getElementById('qcm-exam-view').classList.remove('hidden');
        document.getElementById('qcm-result-view').classList.add('hidden');
        
        renderQuestion();
    } catch (e) { alert(e.message); }
}

function renderQuestion() {
    const { questions, currentIndex, answers } = activeExam;
    const q = questions[currentIndex];
    
    document.getElementById('exam-question-text').innerText = `សំណួរទី ${currentIndex + 1}/${questions.length}: ${q.question_text}`;

    const container = document.getElementById('exam-options-container');
    container.innerHTML = q.options.map((opt, idx) => `
        <button type="button" data-id="${opt.id}" class="opt-btn w-full p-4 text-left rounded-xl border dark:border-slate-700 transition ${answers[q.id] === opt.id ? 'border-brand-600 bg-brand-50 dark:bg-indigo-950 font-bold text-brand-900 dark:text-indigo-200' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}">
            <span class="inline-block w-6 font-bold">${String.fromCharCode(65 + idx)}.</span> ${opt.option_text}
        </button>
    `).join('');

    document.querySelectorAll('.opt-btn').forEach(btn => {
        btn.onclick = () => {
            activeExam.answers[q.id] = parseInt(btn.dataset.id);
            localStorage.setItem('exam_state', JSON.stringify({...activeExam, skippedQuestions}));
            renderQuestion(); 
        };
    });

    document.getElementById('btn-prev-q').disabled = currentIndex === 0;
    document.getElementById('btn-next-q').classList.toggle('hidden', currentIndex === questions.length - 1);
    document.getElementById('btn-submit-qcm').classList.toggle('hidden', currentIndex !== questions.length - 1);
    renderQuestionGrid();
}

function renderQuestionGrid() {
    const grid = document.getElementById('question-number-grid');
    if (!grid) return;

    // ប្រសិនបើក្នុង activeExam មិនទាន់មាន tracking សម្រាប់ visited questions ទេ យើងបង្កើតវាឡើង
    if (!activeExam.visited) activeExam.visited = {};
    activeExam.visited[activeExam.currentIndex] = true; // សំណួរដែលកំពុងបើកស្រាប់ ຖືថាបានបើកហើយ

    grid.innerHTML = activeExam.questions.map((q, idx) => {
        const isAnswered = activeExam.answers[q.id] !== undefined;
        const isActive = idx === activeExam.currentIndex;
        const isVisited = activeExam.visited[idx];
        
        let btnClass = '';

        if (isActive) {
            // 🔵 ១. សំណួរដែលកំពុងស្ថិតនៅ (Active) ៖ ពណ៌ខៀវ
            btnClass = 'bg-brand-600 text-white shadow-md font-bold ring-2 ring-brand-400';
        } else if (isAnswered) {
            // 🟢 ២. សំណួរដែលបានឆ្លើយរួច ៖ ពណ៌ខៀវស្រាល
            btnClass = 'bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 font-semibold';
        } else if (isVisited) {
            // 🔴 ៣. សំណួរដែលធ្លាប់បានបើកឆ្លងកាត់ ឬរំលង (Visited but not answered) ៖ ពណ៌ក្រហម
            btnClass = 'bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300 border border-red-300 font-semibold';
        } else {
            // ⚪ ៤. សំណួរដែលមិនទាន់បានបើកសោះ (Unvisited) ៖ ពណ៌ធម្មតា (ស/ប្រផេះ)
            btnClass = 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600';
        }

        return `<button type="button" data-index="${idx}" class="question-nav-btn w-9 h-9 rounded-lg text-sm flex items-center justify-center transition-all ${btnClass}">${idx + 1}</button>`;
    }).join('');

    document.querySelectorAll('.question-nav-btn').forEach(btn => {
        btn.onclick = () => {
            activeExam.currentIndex = parseInt(btn.dataset.index);
            activeExam.visited[activeExam.currentIndex] = true; // កត់ត្រាថាបានបើកមើលហើយ
            localStorage.setItem('exam_state', JSON.stringify({...activeExam, skippedQuestions}));
            renderQuestion();
        };
    });
}
// ៨. Setup Event Listeners
function setupEvents() {
    const authModal = document.getElementById('auth-modal');
    const modalTitle = document.getElementById('auth-modal-title');
    const regNameGroup = document.getElementById('reg-name-group');
    const authPasswordInput = document.getElementById('auth-password');
    const forgotLinkContainer = document.getElementById('forgot-password-link-container');
    const authSubmitBtn = document.getElementById('btn-auth-submit');

    const btnOpenLogin = document.getElementById('btn-open-login');
    if (btnOpenLogin) {
        btnOpenLogin.onclick = () => {
            authMode = 'login';
            modalTitle.innerText = 'ចូលប្រព័ន្ធ';
            regNameGroup.classList.add('hidden');
            authPasswordInput.placeholder = 'ពាក្យសម្ងាត់';
            if (forgotLinkContainer) forgotLinkContainer.classList.remove('hidden');
            if (authSubmitBtn) authSubmitBtn.innerText = 'ចូលប្រព័ន្ធ';
            authModal.classList.remove('hidden');
        };
    }

    document.querySelectorAll('[id^="btn-close-"], .btn-close-modal').forEach(btn => {
        btn.onclick = () => btn.closest('.fixed')?.classList.add('hidden');
    });

    const formAddSchool = document.getElementById('form-add-school');
    if (formAddSchool) {
        formAddSchool.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('school-name').value.trim();
            const description = document.getElementById('school-desc').value.trim();
            const logoType = document.querySelector('input[name="logo_type"]:checked')?.value || 'emoji';
            
            let logoUrl = logoType === 'emoji' ? document.getElementById('school-icon-emoji').value.trim() || '🏫' : document.getElementById('school-icon-url').value.trim();
            if (logoType === 'upload') {
                const fileInput = document.getElementById('school-icon-file');
                if (fileInput && fileInput.files[0]) logoUrl = await toBase64(fileInput.files[0]);
            }

            try {
                const res = await API.request('/schools', {
                    method: 'POST',
                    body: JSON.stringify({ name, description, logo_type: logoType, logo_url: logoUrl })
                });
                alert(res.message || 'បង្កើតសាលារៀនជោគជ័យ!');
                formAddSchool.reset();
                loadQCMSubjects();
            } catch (err) { alert('មានបញ្ហា: ' + err.message); }
        };
    }

    const formAddFolderSchool = document.getElementById('form-add-folder-school');
    if (formAddFolderSchool) {
        formAddFolderSchool.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-folder-name').value.trim();
            const parentId = document.getElementById('new-folder-parent-id').value;
            const schoolId = document.getElementById('new-folder-school-id').value;

            if (!name) return alert('សូមបញ្ចូលឈ្មោះ Folder!');

            try {
                const res = await API.request('/subjects', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        name, 
                        parentId: parentId ? parseInt(parentId) : null, 
                        schoolId: schoolId ? parseInt(schoolId) : null, 
                        type: 'qcm' 
                    })
                });
                alert(res.message || 'បង្កើត Folder បានជោគជ័យ!');
                formAddFolderSchool.reset();
                loadQCMSubjects();
            } catch (err) { alert('មានបញ្ហា: ' + err.message); }
        };
    }

    const formAddSubject = document.getElementById('form-add-subject');
    if (formAddSubject) {
        formAddSubject.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('subject-name-input').value.trim();
            const parentId = document.getElementById('subject-parent-select').value;

            if (!name) return alert('សូមបញ្ចូលឈ្មោះមុខវិជ្ជា!');

            try {
                const res = await API.request('/subjects', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        name, 
                        parentId: parentId ? parseInt(parentId) : null, 
                        schoolId: null, 
                        type: 'qcm' 
                    })
                });
                alert(res.message || 'បង្កើតមុខវិជ្ជាថ្មីបានជោគជ័យ!');
                formAddSubject.reset();
                loadQCMSubjects();
            } catch (err) { alert('មានបញ្ហា: ' + err.message); }
        };
    }

    const formAddVideoFolder = document.getElementById('form-add-video-folder');
    if (formAddVideoFolder) {
        formAddVideoFolder.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('video-folder-name').value.trim();
            if (!name) return alert('សូមបញ្ចូលឈ្មោះ Folder វីដេអូ!');

            try {
                const res = await API.request('/subjects', {
                    method: 'POST',
                    body: JSON.stringify({ name, parentId: null, schoolId: null, type: 'video' })
                });
                alert(res.message || 'បង្កើត Folder វីដេអូជោគជ័យ!');
                formAddVideoFolder.reset();
                loadLessons();
            } catch (err) { alert('មានបញ្ហា: ' + err.message); }
        };
    }

    // 🟢 គ្រប់គ្រងការ Submit Form បន្ថែមវីដេអូមេរៀនថ្មី (Inline Modal) តែមួយគត់ និងត្រឹមត្រូវ
    const formInlineAddLesson = document.getElementById('form-inline-add-lesson');
    if (formInlineAddLesson) {
        // លុប Event ចាស់ចោល ឬធានាថាមិនមានកូដ Submit ជាន់គ្នាពីរដង
        formInlineAddLesson.onsubmit = async (e) => {
            e.preventDefault();
            const subjectId = document.getElementById('inline-lesson-subject-id')?.value || window.activeVideoFolderId;
            const title = document.getElementById('inline-lesson-title')?.value.trim();
            const rawUrl = document.getElementById('inline-lesson-url')?.value.trim();

            if (!subjectId) {
                return alert('រកមិនឃើញ ID របស់ Folder ទេ! សូមបិទហើយចុចចូល Folder វិញម្តងទៀត។');
            }
            if (!title || !rawUrl) {
                return alert('សូមបំពេញចំណងជើង និង Link វីដេអូឱ្យបានគ្រប់គ្រាន់!');
            }

            // បម្លែង Link ទៅជា Embed URL
            const videoUrl = getYouTubeEmbedUrl(rawUrl);
            const parsedId = parseInt(subjectId);

            try {
                const res = await API.request('/lessons', {
                    method: 'POST',
                    body: JSON.stringify({
                        subject_id: parsedId,
                        subjectId: parsedId,
                        folder_id: parsedId,
                        title: title,
                        video_url: videoUrl,
                        videoUrl: videoUrl,
                        video_type: 'embed'
                    })
                });

                alert(res.message || 'បន្ថែមវីដេអូមេរៀនបានជោគជ័យ!');
                formInlineAddLesson.reset();
                document.getElementById('inline-add-lesson-modal').classList.add('hidden');
                loadLessons();
            } catch (err) {
                alert('មានបញ្ហា: ' + err.message);
            }
        };
    }

    const formAuth = document.getElementById('form-auth');
    if (formAuth) {
        formAuth.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            try {
                const res = await API.login(email, password);
                localStorage.setItem('token', res.token);
                localStorage.setItem('medi_user', JSON.stringify(res.user));
                renderUserSession();
                loadLessons();
                authModal.classList.add('hidden');
            } catch (err) { alert(err.message); }
        };
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            localStorage.removeItem('token');
            localStorage.removeItem('medi_user');
            localStorage.removeItem('exam_state'); 
            renderUserSession();
            loadLessons();
        };
    }

    const btnPrevQ = document.getElementById('btn-prev-q');
    if (btnPrevQ) btnPrevQ.onclick = () => { if (activeExam.currentIndex > 0) { activeExam.currentIndex--; renderQuestion(); } };

    const btnNextQ = document.getElementById('btn-next-q');
    if (btnNextQ) btnNextQ.onclick = () => {
        if (activeExam.currentIndex < activeExam.questions.length - 1) { activeExam.currentIndex++; renderQuestion(); }
    };

    const btnExitExam = document.getElementById('btn-exit-exam');
    if (btnExitExam) btnExitExam.onclick = () => {
        localStorage.removeItem('exam_state'); 
        document.getElementById('qcm-exam-view').classList.add('hidden');
        document.getElementById('school-details-view').classList.remove('hidden');
    };
    // 🟢 គ្រប់គ្រងការប្តូរប្រអប់ Input ពេលជ្រើសរើស Logo Type (Emoji, Upload, URL)
    document.querySelectorAll('.logo-type-radio').forEach(radio => {
        radio.onchange = (e) => {
            const val = e.target.value;
            document.querySelectorAll('.logo-input-section').forEach(sec => sec.classList.add('hidden'));
            
            if (val === 'emoji') {
                document.getElementById('logo-input-emoji')?.classList.remove('hidden');
            } else if (val === 'upload') {
                document.getElementById('logo-input-upload')?.classList.remove('hidden');
            } else if (val === 'url') {
                document.getElementById('logo-input-url')?.classList.remove('hidden');
            }
        };
    });
    // 🟢 ១. ចាប់ព្រឹត្តិការណ៍ចុចប៊ូតុង "កែឈ្មោះ និងរូប" របស់សាលា
    document.querySelectorAll('.btn-edit-school').forEach(btn => {
        btn.onclick = () => {
            const id = btn.dataset.id;
            const name = btn.dataset.name;
            const logo = btn.dataset.logo;
            const logoType = btn.dataset.logotype || 'emoji';
            const desc = btn.dataset.desc;

            // យកតម្លៃមកដាក់បញ្ចូលក្នុង Form ក្នុង Modal
            document.getElementById('edit-school-id').value = id;
            document.getElementById('edit-school-name').value = name;
            document.getElementById('edit-school-desc').value = desc;

            // ជ្រើសរើស Radio Button របស់ Logo Type
            const radio = document.querySelector(`input[name="edit_logo_type"][value="${logoType}"]`);
            if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change'));
            }

            if (logoType === 'emoji') {
                const emojiInput = document.getElementById('edit-school-icon-emoji');
                if (emojiInput) emojiInput.value = logo;
            } else if (logoType === 'url') {
                const urlInput = document.getElementById('edit-school-icon-url');
                if (urlInput) urlInput.value = logo;
            }

            // បើកបង្ហាញ Modal កែប្រែសាលា
            document.getElementById('edit-school-modal')?.classList.remove('hidden');
        };
    });

    // 🟢 ២. គ្រប់គ្រងការ Submit Form កែប្រែសាលារៀន
    // 🟢 គ្រប់គ្រងការ Submit Form កែប្រែសាលារៀន
    const formEditSchool = document.getElementById('form-edit-school');
    if (formEditSchool) {
        formEditSchool.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-school-id').value;
            const name = document.getElementById('edit-school-name').value.trim();
            const description = document.getElementById('edit-school-desc').value.trim();
            const logoType = document.querySelector('input[name="edit_logo_type"]:checked')?.value || 'emoji';
            
            let logoUrl = logoType === 'emoji' ? document.getElementById('edit-school-icon-emoji').value.trim() || '🏫' : document.getElementById('edit-school-icon-url').value.trim();
            if (logoType === 'upload') {
                const fileInput = document.getElementById('edit-school-icon-file');
                if (fileInput && fileInput.files[0]) logoUrl = await toBase64(fileInput.files[0]);
            }

            try {
                const res = await API.request(`/schools/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ name, description, logo_type: logoType, logo_url: logoUrl })
                });
                alert(res.message || 'កែប្រែសាលារៀនបានជោគជ័យ!');
                document.getElementById('edit-school-modal')?.classList.add('hidden');
                
                const schools = await API.getSchools();
                renderAdminSchoolsList(schools);
                loadQCMSubjects();
            } catch (err) {
                alert('មានបញ្ហា: ' + err.message);
            }
        };
    }

    // ប៊ូតុងបិទ Modal កែប្រែសាលា
    const btnCancelEditSchool = document.getElementById('btn-cancel-edit-school');
    if (btnCancelEditSchool) {
        btnCancelEditSchool.onclick = () => {
            document.getElementById('edit-school-modal')?.classList.add('hidden');
        };
    }
    const btnCloseEditSchoolModal = document.getElementById('btn-close-edit-school-modal');
    if (btnCloseEditSchoolModal) {
        btnCloseEditSchoolModal.onclick = () => {
            document.getElementById('edit-school-modal')?.classList.add('hidden');
        };
    }
    // 🟢 គ្រប់គ្រងការប្តូរប្រអប់ Input ពេលជ្រើសរើស Logo Type ក្នុង Modal កែប្រែសាលា
    document.querySelectorAll('.edit-logo-type-radio').forEach(radio => {
        radio.onchange = (e) => {
            const val = e.target.value;
            document.querySelectorAll('.edit-logo-input-section').forEach(sec => sec.classList.add('hidden'));
            
            if (val === 'emoji') {
                document.getElementById('edit-logo-input-emoji')?.classList.remove('hidden');
            } else if (val === 'upload') {
                document.getElementById('edit-logo-input-upload')?.classList.remove('hidden');
            } else if (val === 'url') {
                document.getElementById('edit-logo-input-url')?.classList.remove('hidden');
            }
        };
    });
    // 🟢 គ្រប់គ្រងការ Submit Form បន្ថែមសំណួរ QCM ម្តងមួយ (Manual)
    const formAddQcm = document.getElementById('form-add-qcm');
    if (formAddQcm) {
        formAddQcm.onsubmit = async (e) => {
            e.preventDefault();
            
            const subjectId = document.getElementById('qcm-select-subject')?.value;
            const questionText = document.getElementById('qcm-question-text')?.value.trim();
            const explanation = document.getElementById('qcm-explanation')?.value.trim() || '';
            
            if (!subjectId) return alert('សូមជ្រើសរើសមុខវិជ្ជាជាមុនសិន!');
            if (!questionText) return alert('សូមបំពេញខ្លឹមសារសំណួរ!');

            const optInputs = document.querySelectorAll('.qcm-opt-input');
            const options = [];
            let correctIndex = 0;

            const radioButtons = document.querySelectorAll('input[name="correct_opt"]');
            radioButtons.forEach((radio, idx) => {
                if (radio.checked) correctIndex = idx;
            });

            optInputs.forEach((input, idx) => {
                options.push({
                    option_text: input.value.trim(),
                    is_correct: idx === correctIndex ? 1 : 0
                });
            });

            if (options.some(opt => !opt.option_text)) {
                return alert('សូមបំពេញជម្រើសចម្លើយឱ្យបានគ្រប់ទាំង ៤!');
            }

            try {
                // 🟢 ត្រូវប្រើ '/qcm/questions' និងផ្ញើ Key ជា subjectId, questionText ឱ្យត្រូវជាមួយ qcmRoutes.js
                const res = await API.request('/qcm/questions', {
                    method: 'POST',
                    body: JSON.stringify({
                        subjectId: parseInt(subjectId),
                        questionText: questionText,
                        explanation: explanation,
                        options: options
                    })
                });

                alert(res.message || 'បន្ថែមសំណួរ QCM បានជោគជ័យ!');
                formAddQcm.reset();
                loadAdminQuestions(subjectId);
                loadQCMSubjects();
            } catch (err) {
                alert('មានបញ្ហា: ' + err.message);
            }
        };
    }
    // 🟢 ចាប់ Event ពេល Admin ប្តូរមុខវិជ្ជាក្នុង Dropdown បញ្ជីសំណួរ QCM
    const adminFilterSubject = document.getElementById('admin-filter-subject');
    if (adminFilterSubject) {
        adminFilterSubject.onchange = (e) => {
            const subjectId = e.target.value;
            if (subjectId) {
                loadAdminQuestions(subjectId); // ហៅមុខងារទាញយកសំណួរមកបង្ហាញ
            }
        };
    }

    // 🟢 ចាប់ Event ពេល Admin វាយស្វែងរកសំណួរ (Search Input)
    const adminSearchQuestion = document.getElementById('admin-search-question');
    if (adminSearchQuestion) {
        adminSearchQuestion.oninput = () => {
            const subjectId = adminFilterSubject ? adminFilterSubject.value : '';
            if (subjectId) {
                loadAdminQuestions(subjectId);
            }
        };
    }
    // 🟢 គ្រប់គ្រងការ Import សំណួរពី Excel File (Bulk Import)
    const btnImportExcel = document.getElementById('btn-import-excel');
    if (btnImportExcel) {
        btnImportExcel.onclick = async () => {
            const subjectSelectId = document.getElementById('excel-import-subject-id')?.value;
            const fileInput = document.getElementById('excel-file-input');

            if (!subjectSelectId) {
                return alert('សូមជ្រើសរើសមុខវិជ្ជាជាមុនសិន!');
            }
            if (!fileInput || !fileInput.files[0]) {
                return alert('សូមជ្រើសរើស Excel File (.xlsx, .xls)!');
            }

            const file = fileInput.files[0];
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonRows = XLSX.utils.sheet_to_json(worksheet);

                    if (!jsonRows || jsonRows.length === 0) {
                        return alert('មិនមានទិន្នន័យនៅក្នុង Excel File នេះទេ!');
                    }

                    // แปลงទិន្នន័យឱ្យស្របតាមទម្រង់ដែល Backend (qcmRoutes.js) ត្រូវការ
                    const questionsToImport = jsonRows.map(row => {
                        // Header ត្រូវមាន: question_text, option_a, option_b, option_c, option_d, correct_option, explanation
                        const correctOptLetter = String(row.correct_option || 'A').trim().toUpperCase();
                        
                        // កំណត់ index របស់ចម្លើយដែលត្រូវ (A=0, B=1, C=2, D=3)
                        let correctIdx = 0;
                        if (correctOptLetter === 'B') correctIdx = 1;
                        else if (correctOptLetter === 'C') correctIdx = 2;
                        else if (correctOptLetter === 'D') correctIdx = 3;

                        return {
                            subjectId: parseInt(subjectSelectId),
                            questionText: String(row.question_text || '').trim(),
                            explanation: String(row.explanation || '').trim(),
                            options: [
                                { option_text: String(row.option_a || '').trim(), is_correct: correctIdx === 0 ? 1 : 0 },
                                { option_text: String(row.option_b || '').trim(), is_correct: correctIdx === 1 ? 1 : 0 },
                                { option_text: String(row.option_c || '').trim(), is_correct: correctIdx === 2 ? 1 : 0 },
                                { option_text: String(row.option_d || '').trim(), is_correct: correctIdx === 3 ? 1 : 0 }
                            ]
                        };
                    });

                    // ផ្ញើទិន្នន័យទៅកាន់ Backend /qcm/questions/bulk[cite: 16]
                    const res = await API.request('/qcm/questions/bulk', {
                        method: 'POST',
                        body: JSON.stringify({ questions: questionsToImport })
                    });

                    alert(res.message || 'Import សំណួរពី Excel បានជោគជ័យ!');
                    fileInput.value = '';
                    loadAdminQuestions(subjectSelectId);
                    loadQCMSubjects();
                } catch (err) {
                    alert('មានបញ្ហាពេលអាន Excel File: ' + err.message);
                }
            };

            reader.readAsArrayBuffer(file);
        };
    }
    // 🟢 ចាប់ Event ពេលចុចប៊ូតុង "បញ្ជាក់បញ្ចប់" (Submit QCM Exam)
    const btnSubmitQcm = document.getElementById('btn-submit-qcm');
    if (btnSubmitQcm) {
        btnSubmitQcm.onclick = async () => {
            if (!confirm('តើអ្នកពិតជាចង់បញ្ជាក់បញ្ចប់ការប្រឡងនេះមែនទេ?')) return;

            const { subjectId, questions, answers } = activeExam;
            let score = 0;
            const reviewDetails = [];

            questions.forEach(q => {
                const userSelectedOptId = answers[q.id];
                // ស្វែងរកជម្រើសចម្លើយដែលត្រឹមត្រូវ (is_correct === 1)
                const correctOpt = q.options.find(o => o.is_correct === 1 || o.is_correct === true);
                const isCorrect = userSelectedOptId !== undefined && correctOpt && userSelectedOptId === correctOpt.id;

                if (isCorrect) score++;

                reviewDetails.push({
                    questionText: q.question_text,
                    options: q.options,
                    userSelected: userSelectedOptId,
                    correctOptionId: correctOpt ? correctOpt.id : null,
                    explanation: q.explanation,
                    isCorrect: isCorrect
                });
            });

            // លាក់ Exam View និងបង្ហាញ Result View
            document.getElementById('qcm-exam-view').classList.add('hidden');
            const resultView = document.getElementById('qcm-result-view');
            if (resultView) {
                resultView.classList.remove('hidden');
                document.getElementById('result-score-text').innerText = `${score} / ${questions.length}`;

                // បង្ហាញការពិនិត្យចម្លើយ (Review Container)
                const reviewContainer = document.getElementById('exam-review-container');
                if (reviewContainer) {
                    reviewContainer.innerHTML = reviewDetails.map((rev, idx) => `
                        <div class="p-4 rounded-2xl border ${rev.isCorrect ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-red-200 bg-red-50/50 dark:bg-red-950/20'} mb-3">
                            <p class="font-bold text-sm text-slate-900 dark:text-white mb-2">${idx + 1}. ${rev.questionText}</p>
                            <div class="space-y-1 text-xs mb-2">
                                ${rev.options.map(opt => {
                                    let style = 'text-slate-600 dark:text-slate-300';
                                    if (opt.id === rev.correctOptionId) style = 'font-bold text-emerald-600 dark:text-emerald-400';
                                    else if (opt.id === rev.userSelected && !rev.isCorrect) style = 'font-bold text-red-600 dark:text-red-400 line-through';
                                    return `<div class="${style}">- ${opt.option_text} ${opt.id === rev.correctOptionId ? ' ✓ (ចម្លើយត្រូវ)' : ''}</div>`;
                                }).join('')}
                            </div>
                            ${rev.explanation ? `<p class="text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 p-2 rounded-lg border dark:border-slate-700">💡 ពន្យល់៖ ${rev.explanation}</p>` : ''}
                        </div>
                    `).join('');
                }
            }

            // សម្អាត State ប្រឡងចេញពី LocalStorage
            localStorage.removeItem('exam_state');
        };
    }

    // 🟢 ចាប់ Event ពេលចុច "ធ្វើតេស្តម្តងទៀត" (Retake Exam)
    const btnRetakeExam = document.getElementById('btn-retake-exam');
    if (btnRetakeExam) {
        btnRetakeExam.onclick = () => {
            document.getElementById('qcm-result-view').classList.add('hidden');
            document.getElementById('school-card-view').classList.remove('hidden');
        };
    }
    // 🟢 ចាប់ Event ពេលចុចលើកាត "តាមដានលទ្ធផល" នៅលើទំព័រដើម
    const cardTrackResult = document.getElementById('card-track-result');
    if (cardTrackResult) {
        cardTrackResult.onclick = () => {
            // ប្តូរទៅកាន់ផ្ទាំងប្រឡង QCM (tab-qcm) ស្វ័យប្រវត្តិ
            const navQcmBtn = document.getElementById('nav-qcm');
            if (navQcmBtn) {
                navQcmBtn.click();
            } else {
                alert('សូមចូលទៅកាន់ផ្ទាំង ប្រឡង QCM ដើម្បីមើលលទ្ធផលរបស់អ្នក!');
            }
        };
    }
}

// 🟢 មុខងារគ្រប់គ្រង Dark Mode
function setupDarkMode() {
    const themeToggleBtn = document.getElementById('btn-theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark');
        if (themeIcon) themeIcon.innerText = '☀️';
    }

    if (themeToggleBtn) {
        themeToggleBtn.onclick = () => {
            document.documentElement.classList.toggle('dark');
            const isDark = document.documentElement.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            if (themeIcon) themeIcon.innerText = isDark ? '☀️' : '🌙';
        };
    }
}
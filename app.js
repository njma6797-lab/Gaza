(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  let currentUser = null;
  let currentRepo = null;
  const repoFiles = new Map();

  function toast(message) {
    const el = $('toast');
    if (!el) return;

    el.textContent = message;
    el.classList.add('show');

    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 3500);
  }

  function status(message, busy = false) {
    const el = $('saveStatus');
    if (!el) return;

    el.textContent = message;
    el.style.color = busy ? '#b39aff' : '#55e0d0';
  }

  function authReady() {
    const c = window.NEGM_FIREBASE_CONFIG;

    return Boolean(
      c &&
      c.apiKey &&
      !c.apiKey.includes('PASTE_') &&
      c.projectId &&
      !c.projectId.includes('PASTE_') &&
      c.appId &&
      !c.appId.includes('PASTE_')
    );
  }

  function firebaseAuth() {
    if (!authReady()) {
      throw new Error('أكمل إعدادات Firebase أولًا.');
    }

    if (!window.firebase) {
      throw new Error('مكتبة Firebase غير محمّلة.');
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(window.NEGM_FIREBASE_CONFIG);
    }

    return firebase.auth();
  }

  function setAuthUI(user) {
    const loginBtn = $('loginBtn');
    const logoutBtn = $('logoutBtn');
    const authState = $('authState');

    if (loginBtn) loginBtn.classList.toggle('hidden', Boolean(user));
    if (logoutBtn) logoutBtn.classList.toggle('hidden', !user);

    if (authState) {
      authState.textContent = user
        ? (user.displayName || user.email || 'مسجل الدخول')
        : 'غير متصل';

      authState.classList.toggle('connected', Boolean(user));
    }
  }

  function restoreGitHubToken() {
    try {
      const token = sessionStorage.getItem('negm_github_token');

      if (token && window.NegmGitHub) {
        NegmGitHub.setToken(token);
        return true;
      }
    } catch (e) {
      console.warn('تعذر استعادة جلسة GitHub:', e);
    }

    return false;
  }

  async function login() {
    try {
      const auth = firebaseAuth();

      const provider = new firebase.auth.GithubAuthProvider();
      provider.addScope('repo');
      provider.addScope('read:user');

      const result = await auth.signInWithPopup(provider);

      const credential =
        firebase.auth.GithubAuthProvider.credentialFromResult(result);

      if (!credential || !credential.accessToken) {
        throw new Error(
          'لم يرجع GitHub رمز الوصول. راجع إعدادات GitHub داخل Firebase Authentication.'
        );
      }

      sessionStorage.setItem(
        'negm_github_token',
        credential.accessToken
      );

      NegmGitHub.setToken(credential.accessToken);

      currentUser = await NegmGitHub.user();

      setAuthUI(result.user);

      await loadRepos();

      toast('تم تسجيل الدخول وربط GitHub بنجاح.');
    } catch (e) {
      console.error('Login error:', e);

      const code = e.code || '';

      if (code === 'auth/popup-closed-by-user') {
        toast('تم إغلاق نافذة تسجيل الدخول قبل اكتمال العملية.');
      } else if (code === 'auth/unauthorized-domain') {
        toast('أضف نطاق GitHub Pages إلى النطاقات المسموح بها في Firebase.');
      } else {
        toast(e.message || 'تعذر تسجيل الدخول.');
      }
    }
  }

  async function logout() {
    try {
      if (window.firebase && firebase.apps.length) {
        await firebase.auth().signOut();
      }
    } catch (e) {
      console.error(e);
    }

    try {
      sessionStorage.removeItem('negm_github_token');
    } catch (e) {
      console.warn(e);
    }

    NegmGitHub.setToken(null);

    currentUser = null;
    currentRepo = null;
    repoFiles.clear();

    setAuthUI(null);

    const select = $('repoSelect');

    if (select) {
      select.innerHTML =
        '<option value="">سجّل الدخول واربط GitHub أولًا</option>';
    }

    if ($('repoInfo')) $('repoInfo').textContent = '';

    status('غير متصل');

    toast('تم تسجيل الخروج.');
  }

  async function loadRepos() {
    if (!NegmGitHub.connected()) {
      toast('اربط حساب GitHub أولًا.');
      return;
    }

    try {
      const repos = await NegmGitHub.repos();
      const select = $('repoSelect');

      if (!select) return;

      select.innerHTML = '<option value="">اختر مستودعًا</option>';

      repos.forEach(repo => {
        const option = document.createElement('option');

        option.value = repo.full_name;
        option.textContent =
          (repo.private ? '🔒 ' : '') + repo.full_name;

        select.appendChild(option);
      });

      toast('تم تحميل المستودعات: ' + repos.length);
    } catch (e) {
      console.error(e);
      toast('تعذر تحميل المستودعات: ' + e.message);
    }
  }

  async function openRepo() {
    if (!NegmGitHub.connected()) {
      toast('اربط حساب GitHub أولًا.');
      return;
    }

    const full = $('repoSelect')?.value;

    if (!full) {
      toast('اختر مستودعًا.');
      return;
    }

    const [owner, repo] = full.split('/');

    currentRepo = { owner, repo };

    try {
      status('جارٍ تحميل الملفات…', true);

      const data = await NegmGitHub.tree(owner, repo, '');

      repoFiles.clear();

      for (const item of data) {
        if (item.type !== 'file' || item.size > 350000) continue;

        try {
          const file = await NegmGitHub.getFile(
            owner,
            repo,
            item.path
          );

          repoFiles.set(item.path, file.sha);

          if (item.path === 'index.html') {
            NegmEditor.setContent(item.path, file.content);
          }
        } catch (e) {
          console.warn('تعذر تحميل الملف:', item.path, e.message);
        }
      }

      if ($('repoInfo')) {
        $('repoInfo').textContent =
          full + ' · ' + data.length + ' عنصر';
      }

      status('تم فتح المستودع');

      toast('تم فتح المستودع.');
    } catch (e) {
      console.error(e);
      status('تعذر التحميل');
      toast(e.message);
    }
  }

  async function createRepo() {
    if (!NegmGitHub.connected()) {
      toast('اربط حساب GitHub أولًا.');
      return;
    }

    const name = prompt('اسم المستودع الجديد:');

    if (!name) return;

    try {
      const repo = await NegmGitHub.createRepo(name);

      await loadRepos();

      $('repoSelect').value = repo.full_name;

      await openRepo();

      toast('تم إنشاء المستودع.');
    } catch (e) {
      toast(e.message);
    }
  }

  async function save() {
    if (!currentRepo) {
      toast('افتح مستودعًا أولًا.');
      return;
    }

    status('جارٍ الحفظ…', true);

    try {
      for (const [path, content] of NegmEditor.all()) {
        const sha = repoFiles.get(path) || null;

        let result;

        if (content.startsWith('data:')) {
          const comma = content.indexOf(',');

          if (comma < 0) {
            throw new Error('تنسيق الملف غير صالح: ' + path);
          }

          const base64 = content.slice(comma + 1);

          result = await NegmGitHub.uploadBinary(
            currentRepo.owner,
            currentRepo.repo,
            path,
            base64,
            sha,
            'Upload ' + path + ' via NEGM CODE LAB'
          );
        } else {
          result = await NegmGitHub.putFile(
            currentRepo.owner,
            currentRepo.repo,
            path,
            content,
            'Update ' + path + ' via NEGM CODE LAB',
            sha
          );
        }

        if (result?.content?.sha) {
          repoFiles.set(path, result.content.sha);
        }
      }

      status('تم الحفظ ✓');

      toast('تم حفظ الملفات في مستودع GitHub.');
    } catch (e) {
      console.error(e);

      status('فشل الحفظ');

      toast('فشل الحفظ: ' + e.message);
    }
  }

  function newFile() {
    const path = prompt(
      'مسار الملف، مثال: css/style.css أو assets/logo.png'
    );

    if (!path) return;

    try {
      NegmEditor.add(path, '');

      toast('تم إنشاء الملف محليًا. اضغط حفظ لإرساله إلى GitHub.');
    } catch (e) {
      toast(e.message);
    }
  }

  async function upload() {
    const input = $('fileUpload');
    const files = input?.files;

    if (!files || !files.length) return;

    try {
      const names = await NegmEditor.addUploads(files);

      toast(
        'أُضيفت الملفات للمحرر: ' +
        names.join('، ') +
        '. اضغط حفظ لإرسالها إلى مستودعك.'
      );
    } catch (e) {
      toast(e.message);
    }

    input.value = '';
  }

  async function initializeSession() {
    let auth;

    try {
      auth = firebaseAuth();
    } catch (e) {
      console.error(e);
      toast(e.message);
      return;
    }

    setAuthUI(null);

    auth.onAuthStateChanged(async user => {
      setAuthUI(user);

      if (!user) {
        currentUser = null;
        return;
      }

      // جلسة Firebase لا تعني تلقائيًا وجود رمز GitHub API.
      if (!restoreGitHubToken()) {
        toast(
          'أنت مسجل الدخول إلى Firebase، لكن يلزم ربط GitHub من جديد للوصول إلى المستودعات.'
        );
        return;
      }

      try {
        currentUser = await NegmGitHub.user();

        await loadRepos();
      } catch (e) {
        console.error(e);

        NegmGitHub.setToken(null);

        try {
          sessionStorage.removeItem('negm_github_token');
        } catch (_) {}

        toast(
          'تعذر استعادة ربط GitHub. أعد الربط من زر GitHub.'
        );
      }
    });
  }

  function init() {
    if (!window.NegmEditor || !window.NegmGitHub) {
      console.error('لم يتم تحميل ملفات المحرر أو GitHub.');
      toast('تعذر تحميل ملفات المنصة. راجع ترتيب ملفات JavaScript.');
      return;
    }

    NegmEditor.init();

    if (window.NegmAI) {
      NegmAI.load().then(() => NegmAI.fillTemplates());
    }

    $('loginBtn')?.addEventListener('click', login);
    $('logoutBtn')?.addEventListener('click', logout);
    $('refreshReposBtn')?.addEventListener('click', loadRepos);
    $('loadRepoBtn')?.addEventListener('click', openRepo);
    $('newRepoBtn')?.addEventListener('click', createRepo);
    $('saveBtn')?.addEventListener('click', save);
    $('newFileBtn')?.addEventListener('click', newFile);

    $('connectRepoBtn')?.addEventListener('click', () => {
      if (!NegmGitHub.connected()) {
        login();
      } else {
        $('repoSelect')?.focus();
      }
    });

    $('fileUpload')?.addEventListener('change', upload);

    $('startBtn')?.addEventListener('click', () => {
      $('codeEditor')?.focus();

      document.querySelector('.editor-panel')?.scrollIntoView({
        behavior: 'smooth'
      });
    });

    $('deleteFileBtn')?.addEventListener('click', () => {
      try {
        NegmEditor.removeActive();
        toast('تم حذف الملف محليًا.');
      } catch (e) {
        toast(e.message);
      }
    });

    $('previewBtn')?.addEventListener('click', () => {
      NegmPreview.show();
    });

    $('closePreviewBtn')?.addEventListener('click', () => {
      NegmPreview.hide();
    });

    $('insertTemplateBtn')?.addEventListener('click', () => {
      toast(
        NegmAI.insertSelected()
          ? 'تم إدراج القالب.'
          : 'اختر قالبًا أولًا.'
      );
    });

    $('openAiBtn')?.addEventListener('click', () => {
      $('aiPanel')?.classList.add('visible');
    });

    $('hideAiBtn')?.addEventListener('click', () => {
      $('aiPanel')?.classList.remove('visible');
    });

    $('askAiBtn')?.addEventListener('click', () => {
      NegmAI.ask();
    });

    $('codeEditor')?.addEventListener('input', () => {
      NegmEditor.sync();
      NegmEditor.lineInfo();
      status('تعديلات غير محفوظة');
    });

    $('codeEditor')?.addEventListener('keyup', () => {
      NegmEditor.lineInfo();
    });

    $('codeEditor')?.addEventListener('click', () => {
      NegmEditor.lineInfo();
    });

    initializeSession();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

/* NEGM CODE LAB — GitHub REST API */
window.NegmGitHub = (() => {
  'use strict';

  let token = null;

  const api = 'https://api.github.com';

  const headers = () => ({
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${token}`
  });

  async function request(path, options = {}) {
    if (!token) {
      throw new Error('اربط حساب GitHub أولًا.');
    }

    const response = await fetch(api + path, {
      ...options,
      headers: {
        ...headers(),
        ...(options.headers || {})
      }
    });

    const data = response.status === 204
      ? null
      : await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('انتهت صلاحية رمز GitHub أو أصبح غير صالح. أعد الربط.');
      }

      if (response.status === 403) {
        throw new Error('GitHub رفض الطلب. تحقق من الصلاحيات وحدود الاستخدام.');
      }

      throw new Error(
        data?.message || `GitHub API error ${response.status}`
      );
    }

    return data;
  }

  function setToken(value) {
    token = value || null;
  }

  function connected() {
    return Boolean(token);
  }

  async function user() {
    return request('/user');
  }

  async function repos() {
    return request(
      '/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member'
    );
  }

  async function createRepo(
    name,
    description = 'مشروع من NEGM CODE LAB',
    isPrivate = false
  ) {
    return request('/user/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        private: isPrivate,
        auto_init: true
      })
    });
  }

  function encodePath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  async function contents(owner, repo, path = '') {
    const suffix = path ? '/' + encodePath(path) : '';

    return request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents${suffix}`
    );
  }

  function decodeBase64(value) {
    const binary = atob(value.replace(/\n/g, ''));

    const bytes = Uint8Array.from(
      binary,
      char => char.charCodeAt(0)
    );

    return new TextDecoder().decode(bytes);
  }

  function encodeBase64(value) {
    const bytes = new TextEncoder().encode(value);

    let binary = '';

    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return btoa(binary);
  }

  async function getFile(owner, repo, path) {
    const result = await contents(owner, repo, path);

    if (Array.isArray(result)) {
      throw new Error('المسار مجلد وليس ملفًا.');
    }

    const raw = await request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${result.sha}`
    );

    return {
      sha: result.sha,
      content: decodeBase64(raw.content)
    };
  }

  async function putFile(
    owner,
    repo,
    path,
    content,
    message = 'Update from NEGM CODE LAB',
    sha = null
  ) {
    if (sha === null) {
      try {
        const old = await contents(owner, repo, path);

        if (!Array.isArray(old)) {
          sha = old.sha;
        }
      } catch (error) {
        if (!String(error.message).includes('Not Found')) {
          throw error;
        }
      }
    }

    const body = {
      message,
      content: encodeBase64(content),
      branch: 'main'
    };

    if (sha) body.sha = sha;

    return request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
  }

  async function uploadBinary(
    owner,
    repo,
    path,
    base64,
    sha = null,
    message = 'Upload asset via NEGM CODE LAB'
  ) {
    if (sha === null) {
      try {
        const old = await contents(owner, repo, path);

        if (!Array.isArray(old)) {
          sha = old.sha;
        }
      } catch (error) {
        if (!String(error.message).includes('Not Found')) {
          throw error;
        }
      }
    }

    const body = {
      message,
      content: base64,
      branch: 'main'
    };

    if (sha) body.sha = sha;

    return request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
  }

  async function deleteFile(
    owner,
    repo,
    path,
    sha,
    message = 'Delete from NEGM CODE LAB'
  ) {
    return request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sha,
          branch: 'main'
        })
      }
    );
  }

  async function tree(owner, repo, path = '') {
    const data = await contents(owner, repo, path);

    return Array.isArray(data) ? data : [data];
  }

  window.NEGM_GITHUB_UPLOAD_BINARY = uploadBinary;

  return {
    setToken,
    connected,
    user,
    repos,
    createRepo,
    contents,
    getFile,
    putFile,
    uploadBinary,
    deleteFile,
    tree
  };
})();

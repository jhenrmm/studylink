const API_URL = (
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')
).replace(/\/+$/, '');

const ERROR_MESSAGES = {
  'Email already registered': 'Este e-mail já está cadastrado.',
  'Incorrect email or password': 'E-mail ou senha incorretos.',
  'Could not validate credentials': 'Sessão inválida. Entre novamente.',
  'Not authenticated': 'Sessão inválida. Entre novamente.',
  'Invalid token': 'Sessão inválida. Entre novamente.',
};

function errorMessage(payload) {
  const detail = payload?.detail;

  if (typeof detail === 'string') return ERROR_MESSAGES[detail] || detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || 'Dado inválido').join('; ');
  }
  return 'Não foi possível completar a solicitação.';
}

async function apiFetch(path, { method = 'GET', token, body, params } = {}) {
  if (!API_URL) {
    throw new Error('Backend não configurado: defina VITE_API_URL no Vercel.');
  }

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let url = `${API_URL}${path}`;
  if (params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        value.forEach((item) => search.append(key, item));
      } else {
        search.append(key, String(value));
      }
    }
    const query = search.toString();
    if (query) url += `?${query}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(payload));
  return payload;
}

export const authApi = {
  register(email, password) {
    return apiFetch('/register', { method: 'POST', body: { email, password } });
  },

  login(email, password) {
    return apiFetch('/login', { method: 'POST', body: { email, password } });
  },

  logout(token) {
    return apiFetch('/logout', { method: 'POST', token });
  },

  me(token) {
    return apiFetch('/me', { token });
  },
};

export const profileApi = {
  get(token) {
    return apiFetch('/me/profile', { token });
  },

  save(profile, token) {
    return apiFetch('/me/profile', {
      method: 'PUT',
      token,
      body: {
        name: profile.name || null,
        bio: profile.bio || null,
        academic_level: profile.academic_level || null,
        subjects: profile.subjects || [],
        interests: profile.interests || [],
      },
    });
  },
};

export const studentsApi = {
  list({ subjects = [], interests = [], academic_level = '' } = {}, token) {
    return apiFetch('/students', {
      token,
      params: { subjects, interests, academic_level, limit: 100 },
    });
  },

  get(studentId, token) {
    return apiFetch(`/students/${encodeURIComponent(studentId)}`, { token });
  },
};

export const groupsApi = {
  create({ name, description, subject, joinPolicy = 'open' }, token) {
    return apiFetch('/groups', {
      method: 'POST',
      token,
      body: { name, description, subject, join_policy: joinPolicy },
    });
  },

  list({ subject = '' } = {}, token) {
    return apiFetch('/groups', { token, params: { subject, limit: 100 } });
  },

  mine({ subject = '' } = {}, token) {
    return apiFetch('/me/groups', { token, params: { subject, limit: 100 } });
  },

  get(groupId, token) {
    return apiFetch(`/groups/${encodeURIComponent(groupId)}`, { token });
  },

  members(groupId, token) {
    return apiFetch(`/groups/${encodeURIComponent(groupId)}/members`, { token });
  },

  join(groupId, token) {
    return apiFetch(`/groups/${encodeURIComponent(groupId)}/join`, {
      method: 'POST',
      token,
    });
  },

  request(groupId, token) {
    return apiFetch(`/groups/${encodeURIComponent(groupId)}/requests`, {
      method: 'POST',
      token,
    });
  },

  requests(groupId, token) {
    return apiFetch(`/groups/${encodeURIComponent(groupId)}/requests`, { token });
  },

  approve(groupId, requestId, token) {
    return apiFetch(
      `/groups/${encodeURIComponent(groupId)}/requests/${encodeURIComponent(requestId)}/approve`,
      { method: 'POST', token },
    );
  },

  reject(groupId, requestId, token) {
    return apiFetch(
      `/groups/${encodeURIComponent(groupId)}/requests/${encodeURIComponent(requestId)}/reject`,
      { method: 'POST', token },
    );
  },
};

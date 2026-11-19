// Dados simulados apenas em memória. Ao recarregar a página, tudo é resetado.
const DEMO_EMAIL = 'demo@studylink.com';
const DEMO_PASSWORD = '123456';

let nextUserId = 1;

function makeUser(email, password, createdAt = new Date().toISOString()) {
  return { id: nextUserId++, email, password, createdAt };
}

const state = {
  users: new Map([
    [DEMO_EMAIL, makeUser(DEMO_EMAIL, DEMO_PASSWORD, '2026-01-12T10:00:00.000Z')],
    ['bruno@studylink.com', makeUser('bruno@studylink.com', DEMO_PASSWORD, '2026-02-03T10:00:00.000Z')],
    ['carla@studylink.com', makeUser('carla@studylink.com', DEMO_PASSWORD, '2026-02-18T10:00:00.000Z')],
    ['diego@studylink.com', makeUser('diego@studylink.com', DEMO_PASSWORD, '2026-03-05T10:00:00.000Z')],
    ['elisa@studylink.com', makeUser('elisa@studylink.com', DEMO_PASSWORD, '2026-03-21T10:00:00.000Z')],
    ['felipe@studylink.com', makeUser('felipe@studylink.com', DEMO_PASSWORD, '2026-04-02T10:00:00.000Z')],
  ]),
  profiles: new Map([
    [
      DEMO_EMAIL,
      {
        name: 'Ana Oliveira',
        bio: 'Estudante de Ciência da Computação. Gosto de estudar em grupo e projetos de programação.',
        academic_level: 'Graduação',
        subjects: ['Programação', 'Matemática', 'Banco de Dados'],
        interests: ['Estudos em grupo', 'Pesquisa', 'Projetos'],
        updated_at: '2026-05-10T14:00:00.000Z',
      },
    ],
    [
      'bruno@studylink.com',
      {
        name: 'Bruno Costa',
        bio: 'Cursando o Ensino Médio e me preparando para o ENEM. Gosto de resolver exercícios com colegas.',
        academic_level: 'Ensino Médio',
        subjects: ['Matemática', 'Física'],
        interests: ['Estudos em grupo', 'Concursos'],
        updated_at: '2026-05-08T09:30:00.000Z',
      },
    ],
    [
      'carla@studylink.com',
      {
        name: 'Carla Mendes',
        bio: 'Desenvolvedora em formação. Procuro pessoas para projetos e grupos de estudo de programação.',
        academic_level: 'Graduação',
        subjects: ['Programação', 'Banco de Dados', 'Matemática'],
        interests: ['Projetos', 'Pesquisa', 'Hackathons'],
        updated_at: '2026-05-12T18:20:00.000Z',
      },
    ],
    [
      'diego@studylink.com',
      {
        name: 'Diego Santos',
        bio: 'Estudante de Ciências Naturais. Tenho interesse em pesquisa e leitura de artigos científicos.',
        academic_level: 'Graduação',
        subjects: ['Física', 'Química', 'Cálculo'],
        interests: ['Pesquisa', 'Leitura', 'Laboratório'],
        updated_at: '2026-05-06T11:10:00.000Z',
      },
    ],
    [
      'elisa@studylink.com',
      {
        name: 'Elisa Rocha',
        bio: 'Pesquisadora em formação na área de dados. Gosto de colaborar em projetos e publicações.',
        academic_level: 'Pós-graduação',
        subjects: ['Estatística', 'Matemática', 'Ciência de Dados'],
        interests: ['Pesquisa', 'Projetos', 'Publicações'],
        updated_at: '2026-05-11T16:45:00.000Z',
      },
    ],
  ]),
  tokens: new Map(),
};

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function normalizeKey(value) {
  return String(value).trim().toLocaleLowerCase('pt-BR');
}

function createToken() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `token-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getUserFromToken(token) {
  const email = state.tokens.get(token);
  if (!email) throw new Error('Sessão inválida. Entre novamente.');

  const user = state.users.get(email);
  if (!user) throw new Error('Sessão inválida. Entre novamente.');

  return user;
}

function publicUser(user) {
  return { email: user.email, created_at: user.createdAt };
}

function buildStudent(user, profile, subjectKeys = [], interestKeys = []) {
  const subjects = profile?.subjects || [];
  const interests = profile?.interests || [];
  const commonSubjects = subjects.filter((item) => subjectKeys.includes(normalizeKey(item)));
  const commonInterests = interests.filter((item) => interestKeys.includes(normalizeKey(item)));

  return {
    id: user.id,
    email: user.email,
    name: profile?.name || null,
    bio: profile?.bio || null,
    academic_level: profile?.academic_level || null,
    subjects,
    interests,
    updated_at: profile?.updated_at || null,
    common_subjects: commonSubjects,
    common_interests: commonInterests,
    match_count: commonSubjects.length + commonInterests.length,
  };
}

export const authApi = {
  async register(email, password) {
    const key = normalizeEmail(email);

    if (state.users.has(key)) {
      throw new Error('Este e-mail já está cadastrado.');
    }

    const user = makeUser(key, password);

    state.users.set(key, user);
    return publicUser(user);
  },

  async login(email, password) {
    const key = normalizeEmail(email);
    const user = state.users.get(key);

    if (!user || user.password !== password) {
      throw new Error('E-mail ou senha incorretos.');
    }

    const access_token = createToken();
    state.tokens.set(access_token, key);

    return { access_token, token_type: 'bearer' };
  },

  async logout(token) {
    state.tokens.delete(token);
    return { detail: 'Sessão encerrada.' };
  },

  async me(token) {
    return publicUser(getUserFromToken(token));
  },
};

export const profileApi = {
  async get(token) {
    const user = getUserFromToken(token);
    const profile = state.profiles.get(user.email);

    if (!profile) throw new Error('Academic profile not found');

    return { email: user.email, ...profile };
  },

  async save(profile, token) {
    const user = getUserFromToken(token);

    const saved = {
      name: profile.name || null,
      bio: profile.bio || null,
      academic_level: profile.academic_level || null,
      subjects: profile.subjects || [],
      interests: profile.interests || [],
      updated_at: new Date().toISOString(),
    };

    state.profiles.set(user.email, saved);
    return { email: user.email, ...saved };
  },
};

// Espelha GET /students e GET /students/{id} do backend FastAPI.
export const studentsApi = {
  async list({ subjects = [], interests = [], academic_level = '' } = {}, token) {
    const currentUser = getUserFromToken(token);
    const subjectKeys = subjects.map(normalizeKey).filter(Boolean);
    const interestKeys = interests.map(normalizeKey).filter(Boolean);
    const levelKey = normalizeKey(academic_level);

    const students = [];

    for (const user of state.users.values()) {
      if (user.email === currentUser.email) continue;

      const profile = state.profiles.get(user.email);
      const student = buildStudent(user, profile, subjectKeys, interestKeys);

      if (subjectKeys.length && student.common_subjects.length === 0) continue;
      if (interestKeys.length && student.common_interests.length === 0) continue;
      if (levelKey && normalizeKey(profile?.academic_level || '') !== levelKey) continue;

      students.push(student);
    }

    students.sort((a, b) => {
      if (b.match_count !== a.match_count) return b.match_count - a.match_count;

      const aUpdated = a.updated_at ? Date.parse(a.updated_at) : 0;
      const bUpdated = b.updated_at ? Date.parse(b.updated_at) : 0;
      if (bUpdated !== aUpdated) return bUpdated - aUpdated;

      return a.email.localeCompare(b.email);
    });

    return students;
  },

  async get(studentId, token) {
    getUserFromToken(token);

    const user = Array.from(state.users.values()).find(
      (item) => String(item.id) === String(studentId),
    );

    if (!user) throw new Error('Student not found');

    return buildStudent(user, state.profiles.get(user.email));
  },
};

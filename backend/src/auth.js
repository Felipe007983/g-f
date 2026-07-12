const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const AUTH_SECRET =
  process.env.AUTH_SECRET || 'gf-financeiro-dev-secret-troque-em-producao';

/** Usuários em memória — senha armazenada com hash PBKDF2 + salt */
const users = [];

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex');
}

function createUser({ email, password, name, role = 'admin' }) {
  const salt = crypto.randomBytes(16).toString('hex');
  const user = {
    id: uuidv4(),
    email: String(email).toLowerCase().trim(),
    name: String(name || 'Admin').trim(),
    role,
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  return sanitizeUser(user);
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

function seedDefaultAdmin() {
  if (users.length === 0) {
    createUser({
      email: 'admin@admin.com',
      password: '123456',
      name: 'Administrador',
      role: 'admin',
    });
  }
}

function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
  if (sig !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function login(email, password) {
  const normalized = String(email || '').toLowerCase().trim();
  const user = users.find((u) => u.email === normalized);
  if (!user) throw new Error('E-mail ou senha inválidos');

  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) throw new Error('E-mail ou senha inválidos');

  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const token = signToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: expiresAt,
  });

  return {
    token,
    expiresAt: new Date(expiresAt).toISOString(),
    user: sanitizeUser(user),
  };
}

function logout() {
  return { ok: true };
}

function getSession(token) {
  const payload = verifyToken(token);
  if (!payload) return null;

  return {
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    expiresAt: payload.exp,
  };
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const session = getSession(token);

  if (!session) {
    return res.status(401).json({ error: 'Não autenticado. Faça login.' });
  }

  req.user = {
    id: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
  };
  req.token = token;
  next();
}

seedDefaultAdmin();

module.exports = {
  login,
  logout,
  getSession,
  authMiddleware,
  sanitizeUser,
  seedDefaultAdmin,
};

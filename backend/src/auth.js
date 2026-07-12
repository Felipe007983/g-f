const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/** Usuários em memória — senha armazenada com hash SHA-256 + salt */
const users = [];
const sessions = new Map(); // token -> { userId, email, name, expiresAt }

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

function login(email, password) {
  const normalized = String(email || '')
    .toLowerCase()
    .trim();
  const user = users.find((u) => u.email === normalized);
  if (!user) throw new Error('E-mail ou senha inválidos');

  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) throw new Error('E-mail ou senha inválidos');

  const token = uuidv4();
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  sessions.set(token, {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    expiresAt,
  });

  return {
    token,
    expiresAt: new Date(expiresAt).toISOString(),
    user: sanitizeUser(user),
  };
}

function logout(token) {
  if (token) sessions.delete(token);
  return { ok: true };
}

function getSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
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

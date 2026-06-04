import { Router, type IRouter } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { generateToken } from '../middleware/auth.js';
import type { User, UserWithPassword, LoginRequest, RegisterRequest, AuthResponse } from '@smartshop/shared';

const router: IRouter = Router();

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as LoginRequest;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = db.prepare(`
      SELECT id, email, password_hash as passwordHash, name, role, created_at as createdAt
      FROM users WHERE email = ?
    `).get(email) as UserWithPassword | undefined;

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const response: AuthResponse = {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
    };

    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body as RegisterRequest;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, error: 'Email, password, and name are required' });
    }

    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ success: false, error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user (always as customer for self-registration)
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'customer')
    `).run(email, passwordHash, name);

    const user = db.prepare(`
      SELECT id, email, name, role, created_at as createdAt FROM users WHERE id = ?
    `).get(result.lastInsertRowid) as User;

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const response: AuthResponse = { token, user };
    res.status(201).json({ success: true, data: response });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;

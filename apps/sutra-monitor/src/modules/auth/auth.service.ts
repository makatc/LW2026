import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { pool } from '@lwbeta/db';
import * as bcrypt from 'bcrypt';

export interface JwtPayload {
    sub: string;
    email: string;
    role: string;
}

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: string;
}

@Injectable()
export class AuthService {
    constructor(private jwtService: JwtService) { }

    async validateUser(email: string, password: string): Promise<AuthUser | null> {
        try {
            const result = await pool.query(
                'SELECT * FROM users WHERE email = $1 AND is_active = true',
                [email]
            );

            if (result.rows.length === 0) {
                return null;
            }

            const user = result.rows[0];
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);

            if (!isPasswordValid) {
                return null;
            }

            // Update last login
            await pool.query(
                'UPDATE users SET last_login_at = NOW() WHERE id = $1',
                [user.id]
            );

            return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            };
        } catch (error: any) {
            console.error('❌ validateUser error:', error.message);
            throw error;
        }
    }

    async login(email: string, password: string) {
        const user = await this.validateUser(email, password);

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role
        };

        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        };
    }

    async register(email: string, password: string, name: string) {
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, name, role)
             VALUES ($1, $2, $3, 'user')
             RETURNING id, email, name, role`,
            [email, passwordHash, name]
        );

        const user = result.rows[0];

        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role
        };

        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        };
    }

    async verifyToken(token: string): Promise<JwtPayload> {
        try {
            return this.jwtService.verify(token);
        } catch (error) {
            throw new UnauthorizedException('Invalid token');
        }
    }

    async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
        // 1. Get current user password hash
        const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            throw new UnauthorizedException('User not found');
        }

        const user = result.rows[0];

        // 2. Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Contraseña actual incorrecta');
        }

        // 3. Hash new password
        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        // 4. Update password
        await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newPasswordHash, userId]);
    }

    // Admin Methods
    async findAllUsers() {
        const result = await pool.query('SELECT id, email, name, role, is_active, created_at, last_login_at FROM users ORDER BY created_at DESC');
        return result.rows;
    }

    async deleteUser(id: string) {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
    }

    async createUser(email: string, password: string, name: string, role: string) {
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const result = await pool.query(
            `INSERT INTO users (email, password_hash, name, role)
             VALUES ($1, $2, $3, $4)
             RETURNING id, email, name, role, created_at`,
            [email, passwordHash, name, role]
        );
        return result.rows[0];
    }

    async updateUser(id: string, data: { name?: string; email?: string; password?: string; role?: string }) {
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.name) {
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }

        if (data.email) {
            updates.push(`email = $${paramIndex++}`);
            values.push(data.email);
        }

        if (data.role) {
            updates.push(`role = $${paramIndex++}`);
            values.push(data.role);
        }

        if (data.password) {
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(data.password, saltRounds);
            updates.push(`password_hash = $${paramIndex++}`);
            values.push(passwordHash);
        }

        if (updates.length === 0) return null;

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, email, name, role`;

        const result = await pool.query(query, values);
        return result.rows[0];
    }
}

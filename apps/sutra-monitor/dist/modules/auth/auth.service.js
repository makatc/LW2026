"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const db_1 = require("@lwbeta/db");
const bcrypt = __importStar(require("bcrypt"));
let AuthService = exports.AuthService = class AuthService {
    constructor(jwtService) {
        this.jwtService = jwtService;
    }
    async validateUser(email, password) {
        try {
            const result = await db_1.pool.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
            if (result.rows.length === 0) {
                return null;
            }
            const user = result.rows[0];
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);
            if (!isPasswordValid) {
                return null;
            }
            // Update last login
            await db_1.pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
            return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            };
        }
        catch (error) {
            console.error('❌ validateUser error:', error.message);
            throw error;
        }
    }
    async login(email, password) {
        const user = await this.validateUser(email, password);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const payload = {
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
    async register(email, password, name) {
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        // Create user
        const result = await db_1.pool.query(`INSERT INTO users (email, password_hash, name, role)
             VALUES ($1, $2, $3, 'user')
             RETURNING id, email, name, role`, [email, passwordHash, name]);
        const user = result.rows[0];
        const payload = {
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
    async verifyToken(token) {
        try {
            return this.jwtService.verify(token);
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Invalid token');
        }
    }
    async changePassword(userId, currentPassword, newPassword) {
        // 1. Get current user password hash
        const result = await db_1.pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            throw new common_1.UnauthorizedException('User not found');
        }
        const user = result.rows[0];
        // 2. Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Contraseña actual incorrecta');
        }
        // 3. Hash new password
        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
        // 4. Update password
        await db_1.pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newPasswordHash, userId]);
    }
    // Admin Methods
    async findAllUsers() {
        const result = await db_1.pool.query('SELECT id, email, name, role, is_active, created_at, last_login_at FROM users ORDER BY created_at DESC');
        return result.rows;
    }
    async deleteUser(id) {
        await db_1.pool.query('DELETE FROM users WHERE id = $1', [id]);
    }
    async createUser(email, password, name, role) {
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const result = await db_1.pool.query(`INSERT INTO users (email, password_hash, name, role)
             VALUES ($1, $2, $3, $4)
             RETURNING id, email, name, role, created_at`, [email, passwordHash, name, role]);
        return result.rows[0];
    }
    async updateUser(id, data) {
        const updates = [];
        const values = [];
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
        if (updates.length === 0)
            return null;
        updates.push(`updated_at = NOW()`);
        values.push(id);
        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, email, name, role`;
        const result = await db_1.pool.query(query, values);
        return result.rows[0];
    }
};
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map
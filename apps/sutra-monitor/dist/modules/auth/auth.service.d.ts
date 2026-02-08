import { JwtService } from '@nestjs/jwt';
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
export declare class AuthService {
    private jwtService;
    constructor(jwtService: JwtService);
    validateUser(email: string, password: string): Promise<AuthUser | null>;
    login(email: string, password: string): Promise<{
        access_token: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
        };
    }>;
    register(email: string, password: string, name: string): Promise<{
        access_token: string;
        user: {
            id: any;
            email: any;
            name: any;
            role: any;
        };
    }>;
    verifyToken(token: string): Promise<JwtPayload>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
    findAllUsers(): Promise<any[]>;
    deleteUser(id: string): Promise<void>;
    createUser(email: string, password: string, name: string, role: string): Promise<any>;
    updateUser(id: string, data: {
        name?: string;
        email?: string;
        password?: string;
        role?: string;
    }): Promise<any>;
}

import { AuthService } from './auth.service';
declare class LoginDto {
    email: string;
    password: string;
}
declare class RegisterDto {
    email: string;
    password: string;
    name: string;
}
declare class CreateUserDto {
    email: string;
    password: string;
    name: string;
    role: string;
}
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(loginDto: LoginDto): Promise<{
        access_token: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
        };
    }>;
    register(registerDto: RegisterDto): Promise<{
        access_token: string;
        user: {
            id: any;
            email: any;
            name: any;
            role: any;
        };
    }>;
    getProfile(req: any): Promise<{
        user: {
            id: any;
            email: any;
            role: any;
        };
    }>;
    verifyToken(body: {
        token: string;
    }): Promise<{
        valid: boolean;
        payload: import("./auth.service").JwtPayload;
    }>;
    changePassword(req: any, body: {
        currentPassword: string;
        newPassword: string;
    }): Promise<{
        message: string;
    }>;
    listUsers(): Promise<any[]>;
    createUser(dto: CreateUserDto): Promise<any>;
    deleteUser(id: string): Promise<void>;
    updateUser(id: string, body: {
        name?: string;
        email?: string;
        password?: string;
        role?: string;
    }): Promise<any>;
}
export {};

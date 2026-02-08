import { Controller, Post, Body, Get, UseGuards, Request, Delete, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { Public, Roles } from './decorators';
import { RolesGuard } from './roles.guard';

class LoginDto {
    email!: string;
    password!: string;
}

class RegisterDto {
    email!: string;
    password!: string;
    name!: string;
}

class CreateUserDto {
    email!: string;
    password!: string;
    name!: string;
    role!: string;
}

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Public()
    @Post('login')
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto.email, loginDto.password);
    }

    @Public()
    @Post('register')
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(
            registerDto.email,
            registerDto.password,
            registerDto.name
        );
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('me')
    async getProfile(@Request() req: any) {
        return {
            user: {
                id: req.user.userId,
                email: req.user.email,
                role: req.user.role
            }
        };
    }

    @Public()
    @Post('verify')
    async verifyToken(@Body() body: { token: string }) {
        const payload = await this.authService.verifyToken(body.token);
        return { valid: true, payload };
    }

    @UseGuards(AuthGuard('jwt'))
    @Post('change-password')
    async changePassword(
        @Request() req: any,
        @Body() body: { currentPassword: string; newPassword: string }
    ) {
        await this.authService.changePassword(
            req.user.userId,
            body.currentPassword,
            body.newPassword
        );
        return { message: 'Contraseña actualizada correctamente' };
    }

    // Admin Endpoints
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    @Get('users')
    async listUsers() {
        return this.authService.findAllUsers();
    }

    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    @Post('users')
    async createUser(@Body() dto: CreateUserDto) {
        return this.authService.createUser(dto.email, dto.password, dto.name, dto.role);
    }

    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    @Delete('users/:id')
    async deleteUser(@Param('id') id: string) {
        return this.authService.deleteUser(id);
    }

    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('admin')
    @Post('users/:id') // Using POST or PATCH
    async updateUser(
        @Param('id') id: string,
        @Body() body: { name?: string; email?: string; password?: string; role?: string }
    ) {
        return this.authService.updateUser(id, body);
    }
}

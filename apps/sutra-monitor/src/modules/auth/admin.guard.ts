import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException, Logger } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
    private readonly logger = new Logger(AdminGuard.name);

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        this.logger.log(`Checking AdminGuard for user: ${user ? user.email : 'No User'} with role: ${user ? user.role : 'N/A'}`);

        if (!user) {
            throw new UnauthorizedException('User not authenticated (AdminGuard)');
        }

        if (user.role !== 'admin') {
            this.logger.warn(`Access denied for user ${user.email}. Role is ${user.role}, requires admin.`);
            throw new ForbiddenException('Access denied. Admins only.');
        }

        return true;
    }
}

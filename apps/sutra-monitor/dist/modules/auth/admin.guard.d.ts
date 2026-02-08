import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class AdminGuard implements CanActivate {
    private readonly logger;
    canActivate(context: ExecutionContext): boolean;
}

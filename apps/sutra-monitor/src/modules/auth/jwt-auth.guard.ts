import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './decorators';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private reflector: Reflector) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        try {
            // Attempt standard JWT validation. 
            // If it succeeds, req.user will be populated.
            const result = await super.canActivate(context);
            return result as boolean;
        } catch (err) {
            // If it's a public route, we let the request through even if JWT fails.
            // req.user will remain undefined.
            if (isPublic) {
                return true;
            }
            throw err;
        }
    }

    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (err || !user) {
            if (isPublic) {
                return null;
            }
            throw err || new UnauthorizedException('Please authenticate to access this resource.');
        }

        return user;
    }
}

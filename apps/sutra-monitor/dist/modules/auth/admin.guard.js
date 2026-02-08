"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AdminGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminGuard = void 0;
const common_1 = require("@nestjs/common");
let AdminGuard = exports.AdminGuard = AdminGuard_1 = class AdminGuard {
    constructor() {
        this.logger = new common_1.Logger(AdminGuard_1.name);
    }
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        this.logger.log(`Checking AdminGuard for user: ${user ? user.email : 'No User'} with role: ${user ? user.role : 'N/A'}`);
        if (!user) {
            throw new common_1.UnauthorizedException('User not authenticated (AdminGuard)');
        }
        if (user.role !== 'admin') {
            this.logger.warn(`Access denied for user ${user.email}. Role is ${user.role}, requires admin.`);
            throw new common_1.ForbiddenException('Access denied. Admins only.');
        }
        return true;
    }
};
exports.AdminGuard = AdminGuard = AdminGuard_1 = __decorate([
    (0, common_1.Injectable)()
], AdminGuard);
//# sourceMappingURL=admin.guard.js.map
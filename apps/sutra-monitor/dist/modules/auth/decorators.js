"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserID = exports.Public = exports.Roles = void 0;
const common_1 = require("@nestjs/common");
const Roles = (...roles) => (0, common_1.SetMetadata)('roles', roles);
exports.Roles = Roles;
const Public = () => (0, common_1.SetMetadata)('isPublic', true);
exports.Public = Public;
exports.UserID = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.userId;
});
//# sourceMappingURL=decorators.js.map
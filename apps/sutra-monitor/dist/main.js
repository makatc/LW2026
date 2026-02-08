"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    // Enable CORS for frontend
    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    });
    const port = process.env.PORT || 3001;
    await app.listen(port);
    console.log(`🚀 Sutra Monitor running on port ${port}`);
    // Server ready
}
bootstrap();
//# sourceMappingURL=main.js.map
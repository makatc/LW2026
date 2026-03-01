const { Logger } = require('@nestjs/common');

jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

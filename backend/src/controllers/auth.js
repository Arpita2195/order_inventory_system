const authService = require('../services/auth');
const { clearLoginAttempts } = require('../middlewares/authenticate');
const { sendSuccess, sendException } = require('../utils/response');

const login = async (req, res) => {
  try {
    const data = await authService.login(req.body);
    clearLoginAttempts(req);
    return sendSuccess(res, data, 'Signed in successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

const me = (req, res) => sendSuccess(res, req.user, 'Current user retrieved successfully');

const logout = async (req, res) => {
  try {
    await authService.logout(req.user.id);
    return sendSuccess(res, null, 'Signed out successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

module.exports = { login, me, logout };

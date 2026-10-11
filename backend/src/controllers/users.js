const userService = require('../services/users');
const { sendSuccess, sendException } = require('../utils/response');

const listUsers = async (req, res) => {
  try {
    return sendSuccess(res, await userService.listUsers(req.validatedQuery), 'Users retrieved successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

const createUser = async (req, res) => {
  try {
    return sendSuccess(res, await userService.createUser(req.body), 'User created successfully', 201);
  } catch (error) {
    return sendException(res, error);
  }
};

const updateUser = async (req, res) => {
  try {
    const data = await userService.updateUser(req.params.id, req.body, req.user.id);
    return sendSuccess(res, data, 'User updated successfully');
  } catch (error) {
    return sendException(res, error);
  }
};

module.exports = { listUsers, createUser, updateUser };

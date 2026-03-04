const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{6,}$/;

const isStrongPassword = (password) => STRONG_PASSWORD_REGEX.test(password || '');

module.exports = { STRONG_PASSWORD_REGEX, isStrongPassword };

export const PASSWORD_RULES = [
  {
    key: 'length',
    label: 'At least 8 characters',
    test: (password) => password.length >= 8,
  },
  {
    key: 'uppercase',
    label: 'At least one capital letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    key: 'number',
    label: 'At least one number',
    test: (password) => /\d/.test(password),
  },
  {
    key: 'special',
    label: 'At least one special character',
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export function getPasswordRuleState(password = '') {
  return PASSWORD_RULES.reduce((state, rule) => {
    state[rule.key] = rule.test(password);
    return state;
  }, {});
}

export function isStrongPassword(password = '') {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

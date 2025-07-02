export const validatePhone = (input) => /^0\d{9}$/.test(input);
export const validateIPN = (input) => /^\d{10}$/.test(input);
export const validateDOB = (input) => /^\d{2}\.\d{2}\.\d{4}$/.test(input);
export const validateAmount = (input) => /^\d+(\.\d{1,2})?$/.test(input);

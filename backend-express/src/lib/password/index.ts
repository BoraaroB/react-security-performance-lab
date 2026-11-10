// Password hashing with bcrypt (salted, slow on purpose): a leaked database does not reveal the passwords,
// and each guess in an offline attack costs real CPU time.
export {
  createPasswordHasher,
  MAX_PASSWORD_BYTES,
  PasswordHasherConfigError,
  PasswordTooLongError,
  type PasswordHasher,
  type PasswordHasherOptions,
} from './hashing.js';

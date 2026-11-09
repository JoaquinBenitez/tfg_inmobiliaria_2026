export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  score: number;
}

/**
 * Valida la fortaleza de una contraseña según buenas prácticas de seguridad
 * @param password - La contraseña a validar
 * @returns Objeto PasswordValidationResult con los detalles de la validación
 */
export const validatePasswordStrength = (password: string): PasswordValidationResult => {
  const errors: string[] = [];
  let score = 0;

  // Verificar longitud mínima
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    score += 1;
  }

  // Verificar letras mayúsculas
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }

  // Verificar letras minúsculas  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }

  // Verificar números
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  // Verificar caracteres especiales
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  } else {
    score += 1;
  }

  // Verificar contraseñas débiles comunes
  const commonPasswords = [
    'password', '123456', '12345678', 'qwerty', 'abc123', 'password123',
    'admin', 'letmein', 'welcome', 'monkey', '1234567890'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common and easily guessable');
    score = 0; // Anula el score para contraseñas comunes
  }

  // Verificar caracteres consecutivos
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password should not contain more than 2 consecutive identical characters');
  }

  // Verificar patrones de teclado
  const keyboardPatterns = [
    'qwerty', 'asdfgh', 'zxcvbn', '123456', '654321',
    'qwertyuiop', 'asdfghjkl', 'zxcvbnm'
  ];
  
  const lowerPassword = password.toLowerCase();
  for (const pattern of keyboardPatterns) {
    if (lowerPassword.includes(pattern)) {
      errors.push('Password should not contain common keyboard patterns');
      break;
    }
  }

  // Puntos extra por longitud
  if (password.length >= 12) {
    score += 1;
  }

  // Puntos extra por mezcla de mayúsculas/minúsculas y caracteres especiales
  if (/[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[!@#$%^&*]/.test(password)) {
    score += 1;
  }

  return {
    isValid: errors.length === 0,
    errors,
    score: Math.min(score, 5) // Tope del score en 5
  };
};

/**
 * Obtiene la descripción de la fortaleza de una contraseña según su score
 * @param score - Score de fortaleza de la contraseña (0-5)
 * @returns Descripción de la fortaleza como string
 */
export const getPasswordStrengthDescription = (score: number): string => {
  switch (score) {
    case 0:
    case 1:
      return 'Very Weak';
    case 2:
      return 'Weak';
    case 3:
      return 'Fair';
    case 4:
      return 'Good';
    case 5:
      return 'Strong';
    default:
      return 'Unknown';
  }
};

/**
 * Genera una sugerencia de contraseña segura
 * @returns Una contraseña segura generada aleatoriamente
 */
export const generateSecurePassword = (): string => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const allChars = lowercase + uppercase + numbers + symbols;

  let password: string;
  do {
    // Asegurar al menos un carácter de cada categoría
    const chars = [
      lowercase[Math.floor(Math.random() * lowercase.length)],
      uppercase[Math.floor(Math.random() * uppercase.length)],
      numbers[Math.floor(Math.random() * numbers.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
    ];

    // Completar la longitud restante con caracteres aleatorios
    for (let i = 4; i < 16; i++) {
      chars.push(allChars[Math.floor(Math.random() * allChars.length)]);
    }

    // Shuffle Fisher-Yates (sort(() => Math.random() - 0.5) está sesgado)
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    password = chars.join('');
    // Regenerar si viola nuestra propia regla de "no 3+ caracteres idénticos consecutivos"
  } while (/(.)\1{2,}/.test(password));

  return password;
};
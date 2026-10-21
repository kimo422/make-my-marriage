// Maps Better Auth client errors to the messages shown on the auth screens.

export interface AuthClientError {
  code?: string | undefined;
  status?: number | undefined;
  message?: string | undefined;
}

export function authErrorMessage(error: AuthClientError): string {
  if (error.status === 429) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  switch (error.code) {
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Sign in instead, or reset your password.";
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don't match. Try again or reset your password.";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 8 characters for your password.";
    case "PASSWORD_TOO_LONG":
      return "Use 128 characters or fewer for your password.";
    case "INVALID_TOKEN":
      return "This reset link has expired or was already used. Ask for a new one.";
    default:
      return "Something went wrong. Please try again.";
  }
}

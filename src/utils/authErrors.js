export function getAuthErrorMessage(error) {
  const code = error?.code || ''

  const messages = {
    'auth/unauthorized-domain': 'This deployed domain is not allowed in Firebase Authentication. Add your Vercel domain in Firebase Auth settings.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Invalid email or password.',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Authentication.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.'
  }

  return messages[code] || error?.message || 'Authentication failed. Please try again.'
}

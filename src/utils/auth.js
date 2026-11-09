/**
 * Client-side Authentication Storage & Helper Utilities
 */

export function getAuthToken() {
  try {
    return localStorage.getItem('oxford_token') || '';
  } catch (e) {
    return '';
  }
}

export function getAuthHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getStoredUser() {
  try {
    const token = getAuthToken();
    const raw = localStorage.getItem('oxford_user');
    if (token && raw) {
      const parsed = JSON.parse(raw);
      if (parsed && !parsed.isGuest && parsed.username && parsed.username.toLowerCase() !== 'guest') {
        return parsed;
      }
    }
  } catch (e) {}
  return null;
}

export function getStoredProfile() {
  try {
    const raw = localStorage.getItem('oxford_profile');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setStoredAuth(token, user, profile = null) {
  try {
    if (token) localStorage.setItem('oxford_token', token);
    if (user) localStorage.setItem('oxford_user', JSON.stringify(user));
    if (profile) localStorage.setItem('oxford_profile', JSON.stringify(profile));
  } catch (e) {}
}

export function clearStoredAuth() {
  try {
    localStorage.removeItem('oxford_token');
    localStorage.removeItem('oxford_user');
    localStorage.removeItem('oxford_profile');
  } catch (e) {}
}

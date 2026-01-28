/**
 * Manages user session and authentication
 */

const SESSION_KEY = 'debateUser';

export class SessionManager {
    constructor() {
        this.userData = null;
    }

    /**
     * Save user data to session
     * @param {Object} data - User data { name, pantherId, email }
     */
    saveSession(data) {
        this.userData = data;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    }

    /**
     * Load existing session
     * @returns {Object|null} User data or null if no session exists
     */
    loadSession() {
        const savedUser = sessionStorage.getItem(SESSION_KEY);
        if (savedUser) {
            this.userData = JSON.parse(savedUser);
            return this.userData;
        }
        return null;
    }

    /**
     * Clear session
     */
    clearSession() {
        sessionStorage.removeItem(SESSION_KEY);
        this.userData = null;
    }

    /**
     * Get user's first name
     */
    getFirstName() {
        if (this.userData && this.userData.name) {
            return this.userData.name.split(' ')[0];
        }
        return 'there';
    }

    /**
     * Get full user data
     */
    getUserData() {
        return this.userData;
    }

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return this.userData !== null;
    }
}

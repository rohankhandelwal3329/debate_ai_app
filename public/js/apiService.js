/**
 * API service for server communication
 */

export class ApiService {
    /**
     * Get API configuration from server
     * @returns {Promise<Object>} Configuration object with apiKey
     */
    static async getConfig() {
        const response = await fetch('/api/config');
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get configuration');
        }
        return response.json();
    }
}

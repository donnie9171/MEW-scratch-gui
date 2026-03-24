const STORAGE_KEY = 'agentUserId';

const fallbackUuidV4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
});

const ensureUserId = () => {
    // Keep module safe in non-browser environments (tests/SSR)
    if (typeof window === 'undefined' || !window.localStorage) {
        return 'local-dev-user';
    }

    let value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            value = window.crypto.randomUUID();
        } else {
            value = fallbackUuidV4();
        }
        window.localStorage.setItem(STORAGE_KEY, value);
    }
    return value;
};

const userId = ensureUserId();

// Preserve legacy behavior, but safe in React app
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        const userIdDiv = document.getElementById('userID');
        if (userIdDiv) userIdDiv.textContent = userId;
    });
}

export {userId};
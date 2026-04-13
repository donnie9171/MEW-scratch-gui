/**
 * Local project storage utilities
 * Provides localStorage fallback caching for Scratch sb3 project data
 * Similar to MEW graph localStorage implementation
 */

const PROJECT_STORAGE_KEY = 'scratch.project.sb3.data.v1';
const PROJECT_METADATA_KEY = 'scratch.project.metadata.v1';
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit

const toBase64 = arrayBuffer => {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
    }
    return window.btoa(binary);
};

const fromBase64 = base64 => {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
};

const isVmProjectObject = value => (
    value &&
    typeof value === 'object' &&
    Array.isArray(value.targets)
);

/**
 * Normalize possibly wrapped vmState into a vm.loadProject-compatible payload.
 * Returns either a validated object or original string payload if valid.
 * @param {object|string|null|undefined} rawValue - Potential vmState payload.
 * @returns {object|string|null} - Normalized payload or null when invalid.
 */
export const normalizeVmProjectData = rawValue => {
    if (!rawValue) return null;

    let value = rawValue;

    // Unwrap accidental nested wrappers.
    if (value && typeof value === 'object' && value.vmState) {
        value = value.vmState;
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);

            // If this is a direct VM payload string, keep string form.
            if (isVmProjectObject(parsed)) return value;

            // If this string contains another wrapper, unwrap and normalize again.
            if (parsed && typeof parsed === 'object' && parsed.vmState) {
                return normalizeVmProjectData(parsed.vmState);
            }

            return null;
        } catch {
            return null;
        }
    }

    if (isVmProjectObject(value)) {
        return value;
    }

    return null;
};

/**
 * Save project data to localStorage
 * @param {object} vmState - The project data from vm.toJSON()
 * @param {object} metadata - Optional metadata {projectId, projectTitle, timestamp}
 * @returns {boolean} - Whether save was successful
 */
export const saveProjectLocally = (vmState, metadata = {}) => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return false;
    }

    try {
        const projectData = {
            format: 'json',
            payload: vmState,
            metadata: {
                ...metadata,
                savedAt: new Date().toISOString()
            }
        };

        const serialized = JSON.stringify(projectData);

        // Check if we're exceeding storage limits
        if (serialized.length > MAX_STORAGE_SIZE) {
            console.warn(
                `Project data (${serialized.length} bytes) exceeds storage limit (${MAX_STORAGE_SIZE} bytes)`
            );
            return false;
        }

        window.localStorage.setItem(PROJECT_STORAGE_KEY, serialized);
        window.localStorage.setItem(PROJECT_METADATA_KEY, JSON.stringify(projectData.metadata));
        return true;
    } catch (e) {
        // localStorage can fail for various reasons (quota exceeded, disabled, etc.)
        console.warn('Failed to save project locally:', e);
        return false;
    }
};

/**
 * Save a full sb3 snapshot to localStorage.
 * @param {ArrayBuffer|Uint8Array|Blob} sb3Data - Full sb3 binary payload.
 * @param {object} metadata - Optional metadata {projectId, projectTitle, timestamp}
 * @returns {Promise<boolean>} - Whether save was successful
 */
export const saveProjectSb3Locally = async (sb3Data, metadata = {}) => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return false;
    }

    try {
        let arrayBuffer;
        if (sb3Data instanceof ArrayBuffer) {
            arrayBuffer = sb3Data;
        } else if (sb3Data instanceof Uint8Array) {
            arrayBuffer = sb3Data.buffer.slice(
                sb3Data.byteOffset,
                sb3Data.byteOffset + sb3Data.byteLength
            );
        } else if (typeof Blob !== 'undefined' && sb3Data instanceof Blob) {
            arrayBuffer = await sb3Data.arrayBuffer();
        } else {
            return false;
        }

        const base64Payload = toBase64(arrayBuffer);
        const projectData = {
            format: 'sb3-base64',
            payload: base64Payload,
            metadata: {
                ...metadata,
                savedAt: new Date().toISOString()
            }
        };

        const serialized = JSON.stringify(projectData);
        if (serialized.length > MAX_STORAGE_SIZE) {
            return false;
        }

        window.localStorage.setItem(PROJECT_STORAGE_KEY, serialized);
        window.localStorage.setItem(PROJECT_METADATA_KEY, JSON.stringify(projectData.metadata));
        return true;
    } catch (e) {
        console.warn('Failed to save full sb3 project locally:', e);
        return false;
    }
};

/**
 * Load project data from localStorage
 * @returns {object|null} - Project data with vmState and metadata, or null if not found
 */
export const loadProjectLocally = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
        if (!raw) return null;

        const projectData = JSON.parse(raw);
        // Legacy format support
        if (projectData.vmState) {
            return {
                format: 'json',
                projectData: projectData.vmState,
                metadata: projectData.metadata || null
            };
        }

        if (!projectData.format || !Object.prototype.hasOwnProperty.call(projectData, 'payload')) {
            return null;
        }

        if (projectData.format === 'sb3-base64') {
            return {
                format: 'sb3-base64',
                projectData: fromBase64(projectData.payload),
                metadata: projectData.metadata || null
            };
        }

        if (projectData.format === 'json') {
            return {
                format: 'json',
                projectData: projectData.payload,
                metadata: projectData.metadata || null
            };
        }

        return null;
    } catch (e) {
        console.warn('Failed to load project from local storage:', e);
        return null;
    }
};

/**
 * Load the cached project only when it matches the current project context.
 * This is used to prefer local progress on reload without replacing unrelated projects.
 * @param {number|string|null|undefined} currentProjectId - The project currently being loaded.
 * @returns {object|null} - Matching cached project data or null.
 */
export const loadProjectLocallyForProject = currentProjectId => {
    const cachedProject = loadProjectLocally();
    if (!cachedProject) return null;

    const cachedProjectId = cachedProject.metadata && cachedProject.metadata.projectId;
    const currentId =
        currentProjectId === null || typeof currentProjectId === 'undefined'
            ? null
            : currentProjectId.toString();
    const cachedId =
        cachedProjectId === null || typeof cachedProjectId === 'undefined'
            ? null
            : cachedProjectId.toString();

    // Default project reloads should prefer the local cache.
    if (currentId === null || currentId === '0') {
        return cachedProject;
    }

    if (cachedId === null) {
        return null;
    }

    return cachedId === currentId ? cachedProject : null;
};

/**
 * Load just the metadata (faster than loading full project)
 * @returns {object|null} - Project metadata or null
 */
export const loadProjectMetadataLocally = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(PROJECT_METADATA_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('Failed to load project metadata:', e);
        return null;
    }
};

/**
 * Clear project data from localStorage
 * @returns {boolean} - Whether clear was successful
 */
export const clearProjectLocally = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return false;
    }

    try {
        window.localStorage.removeItem(PROJECT_STORAGE_KEY);
        window.localStorage.removeItem(PROJECT_METADATA_KEY);
        return true;
    } catch (e) {
        console.warn('Failed to clear local project data:', e);
        return false;
    }
};

/**
 * Get size of stored project in bytes
 * @returns {number} - Size in bytes
 */
export const getProjectLocalStorageSize = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return 0;
    }

    try {
        const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
        return raw ? new Blob([raw]).size : 0;
    } catch (e) {
        return 0;
    }
};

export default {
    normalizeVmProjectData,
    saveProjectLocally,
    saveProjectSb3Locally,
    loadProjectLocally,
    loadProjectLocallyForProject,
    loadProjectMetadataLocally,
    clearProjectLocally,
    getProjectLocalStorageSize
};

import JSZip from 'jszip';

const extractMewGraphFromSb3 = async projectData => {
    try {
        const zip = await JSZip.loadAsync(projectData);
        const projectJsonFile = zip.file('project.json');
        if (!projectJsonFile) return null;

        const raw = await projectJsonFile.async('string');
        const projectJson = JSON.parse(raw);

        return (projectJson.meta && projectJson.meta.mew && projectJson.meta.mew.graph) || null;
    } catch (e) {
        return null;
    }
};

export default extractMewGraphFromSb3;
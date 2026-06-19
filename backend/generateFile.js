const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

const codeDirectory = path.join(__dirname, 'srcCodes');

if (!fs.existsSync(codeDirectory)) {
    fs.mkdirSync(codeDirectory, { recursive: true });
}

const generateFile = async (language, code) => {
    const jobId = uuid();
    const fileName = `${jobId}.${language}`;
    const filePath = path.join(codeDirectory, fileName);
    await fs.writeFileSync(filePath, code);
    return { fileName, filePath };
}

module.exports = generateFile;
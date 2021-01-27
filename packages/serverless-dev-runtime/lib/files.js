const os = require('os');
const { spawn } = require('child_process');
const fs = require('fs-extra');
const tmp = require('tmp');
const { logger } = require('@hubspot/cli-lib/logger');
const defaultFunctionPackageJson = require('./templates/default-function-package.json');

const installDeps = folderPath => {
  const npmCmd = os.platform().startsWith('win') ? 'npm.cmd' : 'npm';
  const packageJsonPath = `${folderPath}/package.json`;
  const packageJsonExists = fs.existsSync(packageJsonPath);

  if (!packageJsonExists) {
    logger.debug(`No package.json found: using default dependencies.`);
    fs.writeFileSync(
      `${folderPath}/package.json`,
      JSON.stringify(defaultFunctionPackageJson)
    );
  }

  logger.debug(`Installing dependencies from ${folderPath}/package.json`);

  return new Promise((resolve, reject) => {
    try {
      const npmInstallProcess = spawn(npmCmd, ['i'], {
        env: process.env,
        cwd: folderPath,
      });

      npmInstallProcess.on('exit', data => {
        resolve(data);
      });
    } catch (e) {
      reject(e);
    }
  });
};

const cleanupArtifacts = folderPath => {
  if (fs.existsSync(folderPath)) {
    logger.debug(`Cleaning up artifacts: ${folderPath}.`);
    fs.rmdirSync(folderPath, { recursive: true });
  }
};

const createTemporaryFunction = async functionData => {
  const tmpDir = tmp.dirSync();

  logger.debug(`Created temporary function test folder: ${tmpDir.name}`);

  await fs.copy(functionData.srcPath, tmpDir.name, {
    overwrite: false,
    errorOnExist: true,
  });

  await installDeps(tmpDir.name);

  return {
    ...functionData,
    tmpDir,
  };
};

module.exports = {
  cleanupArtifacts,
  createTemporaryFunction,
  installDeps,
};
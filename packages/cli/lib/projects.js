const fs = require('fs-extra');
const path = require('path');

const chalk = require('chalk');
const findup = require('findup-sync');
const { prompt } = require('inquirer');
const Spinnies = require('spinnies');
const { logger } = require('@hubspot/cli-lib/logger');
const { getEnv } = require('@hubspot/cli-lib/lib/config');
const { createProject } = require('@hubspot/cli-lib/projects');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const {
  ENVIRONMENTS,
  POLLING_DELAY,
  PROJECT_TEMPLATE_REPO,
  PROJECT_OVERALL_STATUS,
  PROJECT_TEXT,
} = require('@hubspot/cli-lib/lib/constants');
const {
  getBuildStatus,
  getDeployStatus,
  fetchProject,
} = require('@hubspot/cli-lib/api/dfs');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');

const PROJECT_STRINGS = {
  BUILD: {
    INITIALIZE: (name, numOfComponents) =>
      `Building ${chalk.bold(
        name
      )}\n\nFound ${numOfComponents} components in this project ...\n`,
    SUCCESS: name => `Built ${chalk.bold(name)}`,
    FAIL: name => `Failed to build ${chalk.bold(name)}`,
  },
  DEPLOY: {
    INITIALIZE: (name, numOfComponents) =>
      `Deploying ${chalk.bold(
        name
      )}\n\nFound ${numOfComponents} components in this project ...\n`,
    SUCCESS: name => `Deployed ${chalk.bold(name)}`,
    FAIL: name => `Failed to deploy ${chalk.bold(name)}`,
  },
};

const isTaskComplete = task => {
  return (
    task.status === PROJECT_OVERALL_STATUS.SUCCESS ||
    task.status === PROJECT_OVERALL_STATUS.FAILURE
  );
};

const writeProjectConfig = (configPath, config) => {
  try {
    fs.ensureFileSync(configPath);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    logger.debug(`Wrote project config at ${configPath}`);
  } catch (e) {
    logger.error(`Could not write project config at ${configPath}`);
  }
};

const getProjectConfig = async projectPath => {
  const configPath = findup('hsproject.json', {
    cwd: projectPath,
    nocase: true,
  });

  if (!configPath) {
    return null;
  }

  try {
    const projectConfig = fs.readFileSync(configPath);
    return JSON.parse(projectConfig);
  } catch (e) {
    logger.error('Could not read from project config');
  }
};

const createProjectConfig = async (projectPath, projectName) => {
  const projectConfig = await getProjectConfig(projectPath);
  const projectConfigPath = path.join(projectPath, 'hsproject.json');

  if (projectConfig) {
    logger.log(
      `Found an existing project config in this folder (${chalk.bold(
        projectConfig.name
      )})`
    );
  } else {
    logger.log(
      `Creating project in ${projectPath ? projectPath : 'the current folder'}`
    );
    const { name, template, srcDir } = await prompt([
      {
        name: 'name',
        message: 'Please enter a project name:',
        when: !projectName,
        validate: input => {
          if (!input) {
            return 'A project name is required';
          }
          return true;
        },
      },
      {
        name: 'template',
        message: 'Start from a template?',
        type: 'rawlist',
        choices: [
          {
            name: 'No template',
            value: 'none',
          },
          {
            name: 'Getting Started Project',
            value: 'getting-started',
          },
        ],
      },
    ]);

    if (template === 'none') {
      fs.ensureDirSync(path.join(projectPath, 'src'));

      writeProjectConfig(projectConfigPath, {
        name: projectName || name,
        srcDir: 'src',
      });
    } else {
      await createProject(
        projectPath,
        'project',
        PROJECT_TEMPLATE_REPO[template],
        ''
      );
      const _config = JSON.parse(fs.readFileSync(projectConfigPath));
      writeProjectConfig(projectConfigPath, {
        ..._config,
        name: projectName || name,
      });
    }

    return { name, srcDir };
  }

  return projectConfig;
};

const validateProjectConfig = (projectConfig, projectDir) => {
  if (!projectConfig) {
    logger.error(
      `Project config not found. Try running 'hs project init' first.`
    );
    process.exit(1);
  }

  if (!projectConfig.name || !projectConfig.srcDir) {
    logger.error(
      'Project config is missing required fields. Try running `hs project init`.'
    );
    process.exit(1);
  }

  if (!fs.existsSync(path.resolve(projectDir, projectConfig.srcDir))) {
    logger.error(
      `Project source directory '${projectConfig.srcDir}' does not exist.`
    );
    process.exit(1);
  }
};

const ensureProjectExists = async (accountId, projectName) => {
  try {
    await fetchProject(accountId, projectName);
  } catch (err) {
    if (err.statusCode === 404) {
      const { shouldCreateProject } = await prompt([
        {
          name: 'shouldCreateProject',
          message: `The project ${projectName} does not exist in ${accountId}. Would you like to create it?`,
          type: 'confirm',
        },
      ]);

      if (shouldCreateProject) {
        try {
          return createProject(accountId, projectName);
        } catch (err) {
          return logApiErrorInstance(err, new ApiErrorContext({ accountId }));
        }
      } else {
        return logger.log(
          `Your project ${chalk.bold(
            projectName
          )} could not be found in ${chalk.bold(accountId)}.`
        );
      }
    }
    logApiErrorInstance(err, new ApiErrorContext({ accountId }));
  }
};

const getProjectDetailUrl = (projectName, accountId) => {
  if (!projectName) return;

  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );

  return `${baseUrl}/developer-projects/${accountId}/project/${projectName}`;
};

const showWelcomeMessage = () => {
  logger.log('');
  logger.log(chalk.bold('Welcome to HubSpot Developer Projects!'));
  logger.log(
    '\n-------------------------------------------------------------\n'
  );
  logger.log(chalk.bold("What's next?\n"));
  logger.log('🎨 Add deployables to your project with `hs create`.\n');
  logger.log(
    `🏗  Run \`hs project upload\` to upload your files to HubSpot and trigger builds.\n`
  );
  logger.log(
    `🚀 Ready to take your project live? Run \`hs project deploy\`.\n`
  );
  logger.log(
    `🔗 Use \`hs project --help\` to learn more about available commands.\n`
  );
  logger.log('-------------------------------------------------------------');
};

const makeGetTaskStatus = taskType => {
  let statusFn, statusText, statusStrings;
  switch (taskType) {
    case 'build':
      statusFn = getBuildStatus;
      statusText = PROJECT_TEXT.BUILD;
      statusStrings = PROJECT_STRINGS.BUILD;
      break;
    case 'deploy':
      statusFn = getDeployStatus;
      statusText = PROJECT_TEXT.DEPLOY;
      statusStrings = PROJECT_STRINGS.DEPLOY;
      break;
    default:
      logger.error(`Cannot get status for task type ${taskType}`);
  }

  return async (accountId, taskName, taskId) => {
    const spinnies = new Spinnies({
      succeedColor: 'white',
      failColor: 'white',
    });

    spinnies.add('overallTaskStatus', { text: 'Beginning' });

    const initialTaskStatus = await statusFn(accountId, taskName, taskId);

    spinnies.update('overallTaskStatus', {
      text: statusStrings.INITIALIZE(
        taskName,
        initialTaskStatus[statusText.SUBTASK_KEY].length
      ),
    });

    for (let subTask of initialTaskStatus[statusText.SUBTASK_KEY]) {
      spinnies.add(subTask[statusText.SUBTASK_NAME_KEY], {
        text: `${chalk.bold(subTask[statusText.SUBTASK_NAME_KEY])} #${taskId} ${
          statusText.STATUS_TEXT[statusText.STATES.ENQUEUED]
        }\n`,
      });
    }

    return new Promise((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        const taskStatus = await statusFn(accountId, taskName, taskId).catch(
          reject
        );

        const { status, [statusText.SUBTASK_KEY]: subTaskStatus } = taskStatus;

        if (spinnies.hasActiveSpinners()) {
          subTaskStatus.forEach(subTask => {
            if (!spinnies.pick(subTask[statusText.SUBTASK_NAME_KEY])) {
              return;
            }

            const updatedText = `${chalk.bold(
              subTask[statusText.SUBTASK_NAME_KEY]
            )} #${taskId} ${statusText.STATUS_TEXT[subTask.status]}\n`;

            switch (subTask.status) {
              case statusText.STATES.SUCCESS:
                spinnies.succeed(subTask[statusText.SUBTASK_NAME_KEY], {
                  text: updatedText,
                });
                break;
              case statusText.STATES.FAILURE:
                spinnies.fail(subTask.buildName, {
                  text: updatedText,
                });
                break;
              default:
                spinnies.update(subTask.buildName, {
                  text: updatedText,
                });
                break;
            }
          });

          if (isTaskComplete(taskStatus)) {
            subTaskStatus.forEach(subBuild => {
              spinnies.remove(subBuild[statusText.SUBTASK_NAME_KEY]);
            });

            if (status === statusText.STATES.SUCCESS) {
              spinnies.succeed('overallTaskStatus', {
                text: statusStrings.SUCCESS(taskName),
              });
            } else if (status === statusText.STATES.FAILURE) {
              spinnies.fail('overallTaskStatus', {
                text: statusStrings.FAIL(taskName),
              });
            }

            clearInterval(pollInterval);
            resolve(taskStatus);
          }
        }
      }, POLLING_DELAY);
    });
  };
};

module.exports = {
  writeProjectConfig,
  getProjectConfig,
  createProjectConfig,
  validateProjectConfig,
  showWelcomeMessage,
  getProjectDetailUrl,
  pollBuildStatus: makeGetTaskStatus('build'),
  pollDeployStatus: makeGetTaskStatus('deploy'),
  ensureProjectExists,
};
const fs = require('fs');
const path = require('path');
const { getCwd } = require('@hubspot/local-dev-lib/path');
const { PROJECT_COMPONENT_TYPES } = require('../../lib/constants');
const { promptUser } = require('./promptUtils');
const { fetchFileFromRepository } = require('@hubspot/local-dev-lib/github');
const { i18n } = require('../lang');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const {
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
  DEFAULT_PROJECT_TEMPLATE_BRANCH,
} = require('../constants');

const i18nKey = 'lib.prompts.createProjectPrompt';

const PROJECT_PROPERTIES = ['name', 'label', 'path', 'insertPath'];

// Based on the node-sanitize-filename package: https://github.com/parshap/node-sanitize-filename/blob/master/index.js
const sanitizeProjectName = projectName => {
  // Windows invalid/control characters
  // eslint-disable-next-line no-control-regex
  const invalidChars = /[<>:"/|?*\x00-\x1F]/g;

  //Replace invalid characters with dash
  let sanitizedProjectName = projectName.replace(invalidChars, '-');

  // Removes trailing periods and spaces for Windows
  sanitizedProjectName = sanitizedProjectName.replace(/[. ]+$/, '');

  // Reserved names check (Windows specific)
  const reservedNames = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
  if (reservedNames.test(sanitizedProjectName)) {
    sanitizedProjectName = `-${sanitizedProjectName}`;
  }

  return sanitizedProjectName;
};

const hasAllProperties = projectList => {
  return projectList.every(config =>
    PROJECT_PROPERTIES.every(p =>
      Object.prototype.hasOwnProperty.call(config, p)
    )
  );
};

const createTemplateOptions = async (templateSource, githubRef) => {
  const hasCustomTemplateSource = Boolean(templateSource);
  let branch = hasCustomTemplateSource
    ? DEFAULT_PROJECT_TEMPLATE_BRANCH
    : githubRef;

  const config = await fetchFileFromRepository(
    templateSource || HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
    'config.json',
    branch
  );

  if (!config || !config[PROJECT_COMPONENT_TYPES.PROJECTS]) {
    logger.error(i18n(`${i18nKey}.errors.noProjectsInConfig`));
    process.exit(EXIT_CODES.ERROR);
  }

  if (!hasAllProperties(config[PROJECT_COMPONENT_TYPES.PROJECTS])) {
    logger.error(i18n(`${i18nKey}.errors.missingPropertiesInConfig`));
    process.exit(EXIT_CODES.ERROR);
  }

  return config[PROJECT_COMPONENT_TYPES.PROJECTS];
};

const createProjectPrompt = async (
  githubRef,
  promptOptions = {},
  skipTemplatePrompt = false
) => {
  let projectTemplates = [];
  if (!skipTemplatePrompt) {
    projectTemplates = await createTemplateOptions(
      promptOptions.templateSource,
      githubRef
    );
  }

  return promptUser([
    {
      name: 'name',
      message: i18n(`${i18nKey}.enterName`),
      when: !promptOptions.name,
      validate: input => {
        if (!input) {
          return i18n(`${i18nKey}.errors.nameRequired`);
        }
        return true;
      },
    },
    {
      name: 'location',
      message: i18n(`${i18nKey}.enterLocation`),
      when: !promptOptions.location,
      default: answers => {
        const projectName = sanitizeProjectName(
          answers.name || promptOptions.name
        );
        return path.resolve(getCwd(), projectName);
      },
      validate: input => {
        if (!input) {
          return i18n(`${i18nKey}.errors.locationRequired`);
        }
        if (fs.existsSync(input)) {
          return i18n(`${i18nKey}.errors.invalidLocation`);
        }
        return true;
      },
    },
    {
      name: 'template',
      message: () => {
        return promptOptions.template &&
          !projectTemplates.find(t => t.name === promptOptions.template)
          ? i18n(`${i18nKey}.errors.invalidTemplate`, {
              template: promptOptions.template,
            })
          : i18n(`${i18nKey}.selectTemplate`);
      },
      when:
        !skipTemplatePrompt &&
        (!promptOptions.template ||
          !projectTemplates.find(t => t.name === promptOptions.template)),
      type: 'list',
      choices: projectTemplates.map(template => {
        return {
          name: template.label,
          value: template,
        };
      }),
    },
  ]);
};

module.exports = {
  createProjectPrompt,
};

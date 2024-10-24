// @ts-nocheck
const HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH =
  'HubSpot/hubspot-project-components';
const DEFAULT_PROJECT_TEMPLATE_BRANCH = 'main';

const FEEDBACK_OPTIONS = {
  BUG: 'bug',
  GENERAL: 'general',
};
const FEEDBACK_URLS = {
  BUG: 'https://github.com/HubSpot/hubspot-cli/issues/new',
  GENERAL:
    'https://docs.google.com/forms/d/e/1FAIpQLSejZZewYzuH3oKBU01tseX-cSWOUsTHLTr-YsiMGpzwcvgIMg/viewform?usp=sf_link',
};
const FEEDBACK_INTERVAL = 10;

const HUBSPOT_FOLDER = '@hubspot';
const MARKETPLACE_FOLDER = '@marketplace';

const CONFIG_FLAGS = {
  USE_CUSTOM_OBJECT_HUBFILE: 'useCustomObjectHubfile',
};

const POLLING_DELAY = 2000;

const POLLING_STATUS = {
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  REVERTED: 'REVERTED',
  FAILURE: 'FAILURE',
};

const PROJECT_CONFIG_FILE = 'hsproject.json';
const PROJECT_BUILD_STATES = {
  BUILDING: 'BUILDING',
  ENQUEUED: 'ENQUEUED',
  FAILURE: 'FAILURE',
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
};
const PROJECT_DEPLOY_STATES = {
  DEPLOYING: 'DEPLOYING',
  FAILURE: 'FAILURE',
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
};
const PROJECT_BUILD_TEXT = {
  STATES: { ...PROJECT_BUILD_STATES },
  STATUS_TEXT: 'Building',
  SUBTASK_KEY: 'subbuildStatuses',
  TYPE_KEY: 'buildType',
  SUBTASK_NAME_KEY: 'buildName',
};
const PROJECT_DEPLOY_TEXT = {
  STATES: { ...PROJECT_DEPLOY_STATES },
  STATUS_TEXT: 'Deploying',
  SUBTASK_KEY: 'subdeployStatuses',
  TYPE_KEY: 'deployType',
  SUBTASK_NAME_KEY: 'deployName',
};
const PROJECT_ERROR_TYPES = {
  PROJECT_LOCKED: 'BuildPipelineErrorType.PROJECT_LOCKED',
  MISSING_PROJECT_PROVISION: 'BuildPipelineErrorType.MISSING_PROJECT_PROVISION',
  BUILD_NOT_IN_PROGRESS: 'BuildPipelineErrorType.BUILD_NOT_IN_PROGRESS',
  SUBBUILD_FAILED: 'BuildPipelineErrorType.DEPENDENT_SUBBUILD_FAILED',
  SUBDEPLOY_FAILED: 'DeployPipelineErrorType.DEPENDENT_SUBDEPLOY_FAILED',
};
const PROJECT_TASK_TYPES = {
  PRIVATE_APP: 'private app',
  PUBLIC_APP: 'public app',
  APP_FUNCTION: 'function',
  CRM_CARD_V2: 'card',
};
const PROJECT_COMPONENT_TYPES = {
  PROJECTS: 'projects',
  COMPONENTS: 'components',
};
const PLATFORM_VERSION_ERROR_TYPES = {
  PLATFORM_VERSION_NOT_SPECIFIED:
    'PlatformVersionErrorType.PLATFORM_VERSION_NOT_SPECIFIED',
  PLATFORM_VERSION_RETIRED: 'PlatformVersionErrorType.PLATFORM_VERSION_RETIRED',
  PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST:
    'PlatformVersionErrorType.PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST',
};

module.exports = {
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
  DEFAULT_PROJECT_TEMPLATE_BRANCH,
  FEEDBACK_OPTIONS,
  FEEDBACK_URLS,
  FEEDBACK_INTERVAL,
  HUBSPOT_FOLDER,
  MARKETPLACE_FOLDER,
  CONFIG_FLAGS,
  POLLING_DELAY,
  POLLING_STATUS,
  PROJECT_CONFIG_FILE,
  PROJECT_BUILD_TEXT,
  PROJECT_DEPLOY_TEXT,
  PROJECT_ERROR_TYPES,
  PROJECT_TASK_TYPES,
  PROJECT_COMPONENT_TYPES,
  PLATFORM_VERSION_ERROR_TYPES,
};
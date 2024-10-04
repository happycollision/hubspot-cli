const { downloadFileOrFolder } = require('@hubspot/local-dev-lib/fileMapper');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  addConfigOptions,
  addAccountOptions,
  addOverwriteOptions,
  addModeOptions,
  addUseEnvironmentOptions,
  getAccountId,
  getMode,
} = require('../lib/commonOpts');
const { resolveLocalPath } = require('../lib/filesystem');
const { validateMode, loadAndValidateOptions } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');
const { i18n } = require('../lib/lang');

const i18nKey = 'commands.fetch';
const { EXIT_CODES } = require('../lib/enums/exitCodes');
const { logError } = require('../lib/errorHandlers/index');
const { getIsInProject } = require('../lib/projects');
const {
  fetchProjectAssetPrompt,
} = require('../lib/prompts/fetchProjectAssetPrompt');
const { uiFeatureHighlight } = require('../lib/ui');

exports.command = 'fetch <src> [dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { src, dest } = options;

  await loadAndValidateOptions(options);

  if (!validateMode(options)) {
    process.exit(EXIT_CODES.ERROR);
  }

  if (typeof src !== 'string') {
    logger.error(i18n(`${i18nKey}.errors.sourceRequired`));
    process.exit(EXIT_CODES.ERROR);
  }

  // If fetching the Elevate theme, check if the destination is in a project.
  if ('@hubspot/elevate' === src) {
    const inProject = getIsInProject(resolveLocalPath(dest));
    // If not in a project, alert the user. Otherwise proceed with the fetch.
    if (!inProject) {
      const fetchAnyway = await fetchProjectAssetPrompt(src);
      if (!fetchAnyway.continue) {
        logger.log('');
        uiFeatureHighlight(
          ['projectCreateCommand'],
          i18n(`${i18nKey}.info.createElevateProjectTitle`)
        );
        process.exit(EXIT_CODES.SUCCESS);
      }
    }
  }

  const accountId = getAccountId(options);
  const mode = getMode(options);

  trackCommandUsage('fetch', { mode }, accountId);

  try {
    // Fetch and write file/folder.
    await downloadFileOrFolder(
      accountId,
      src,
      resolveLocalPath(dest),
      mode,
      options
    );
  } catch (err) {
    logError(err);
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addOverwriteOptions(yargs);
  addModeOptions(yargs, { read: true });
  addUseEnvironmentOptions(yargs);

  yargs.positional('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
  });

  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });

  yargs.options({
    staging: {
      describe: i18n(`${i18nKey}.options.staging.describe`),
      type: 'boolean',
      default: false,
      hidden: true,
    },
  });

  yargs.options({
    assetVersion: {
      type: 'number',
      describe: i18n(`${i18nKey}.options.assetVersion.describe`),
    },
  });

  return yargs;
};
